# tools/whisper-dinle.py — Orion'un kulağı (TÜRKÇE): mikrofon + Whisper, yerel CPU, kalıcı süreç.
#
# tools/nemotron-dinle.py ile AYNI protokol (host/dinleme.js bunu başlatır; renderer ve Orion tarafı değişmez):
#   stdin  (satır):  kayit  → mikrofonu kaydetmeye başla
#                    dur    → kaydı bitir, çöz, sonucu yaz
#                    cik    → çık
#   stdout (JSON satırı, UTF-8):
#     {"olay":"hazir","mikrofon":"...","model":"..."}
#     {"olay":"tanima","metin":"...","ms":812,"sure":2.4,"tepe":0.31}
#     {"olay":"bos","neden":"cok kisa|sessiz|hayalet"}   ← çözülmedi / atıldı, uydurma metin üretilmez
#     {"olay":"hata","hata":"..."}
# Ses dosyaya ya da ağa gitmez; yalnız bellekte durur. Model yerel önbellekte olmalı (bkz. tools/whisper-indir.py): çalışma anında
# indirme YOK, çünkü ilk V basışında dakikalarca donmak Ozyn'e "bozuk" görünürdü.
# Dil Türkçe'ye KİLİTLİ (otomatik dil tanıma kısa komutta yanlış dile kayıyordu). Model: ORION_STT_MODEL (varsayılan openai/whisper-base).
import json
import os
import re
import sys
import threading
import time
import zlib

# Çalışma anında ağa çıkma: model yerel önbellekte olmalı (HuggingFace çevrimdışı kipi; transformers içe aktarılmadan ÖNCE).
os.environ.setdefault("HF_HUB_OFFLINE", "1")

HIZ = 16000
EN_KISA_SN = 0.3     # bundan kısa kayıt tuş titremesidir
SESSIZ_TEPE = 0.01   # bunun altı: mikrofon duymadı; model sessizliğe kelime uydurur
MODEL = os.environ.get("ORION_STT_MODEL", "openai/whisper-base")

# Whisper'ın sessizlikte/gürültüde ürettiği bilinen kalıplar (eğitim verisindeki altyazı kuyrukları). Eşleşirse metin ATILIR.
HAYALET = (
    "altyazı m.k", "altyazı", "izlediğiniz için", "abone ol", "iyi seyirler", "görüşmek üzere", "hoşçakalın", "hoşça kalın",
    "teşekkürler",
)
# Komut kelime ipucu (Whisper'ın "prompt"u): kısa komutlarda ("gece yap", "sis aç") alan sözcüklerine yatkınlık. ORION_STT_IPUCU=0 kapatır.
# DİKKAT: ipucu gürültüde komut UYDURMA riskini artırır; bu yüzden konuşma-var-mı denetimi (konusma_var_mi) ipucundan ÖNCE çalışır.
IPUCU = (
    "Orion. gece yap. gündüz yap. pastel yap. ışığı kıs. sis aç. bloom kapat. zamanı durdur. zaman aksın. "
    "yanıma gel. takip et. otur. ne görüyorsun. neredesin."
)


def yaz(**kv):
    sys.stdout.write(json.dumps(kv, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def hayalet_mi(metin: str) -> bool:
    k = metin.lower().strip(" .!?…\n")
    if k == "" or any(h in k for h in HAYALET):
        return True
    ham = k.encode("utf-8")
    # Tekrar döngüsü ("Hıhıhıhı…") ve aşırı sıkıştırılabilir metin: kod çözücü gürültüde takılmıştır (OpenAI Whisper'ın sıkıştırma oranı eşiği: 2,4).
    if len(ham) > 20 and len(ham) / max(1, len(zlib.compress(ham))) > 2.4:
        return True
    return re.search(r"(.{1,4})\1{5,}", k) is not None


def konusma_var_mi(a) -> bool:
    """Kayıtta konuşma gibi bir şey var mı: 20 ms kareler, taban gürültüsünün 10 dB üstünde EN AZ 160 ms ARDIŞIK. Durağan gürültü
    (beyaz gürültü, uğultu) ve tek tük tık bunu geçemez; Whisper onlara kelime uydurur."""
    kare = 320
    n = len(a) // kare
    if n < 8:
        return False
    e = (a[: n * kare].reshape(n, kare) ** 2).mean(axis=1) + 1e-10
    db = 10 * np.log10(e)
    ses = db > max(float(np.percentile(db, 10)) + 10, -55.0)
    en = ardisik = 0
    for v in ses:
        ardisik = ardisik + 1 if v else 0
        en = max(en, ardisik)
    return en >= 8


try:
    sys.stdout.reconfigure(encoding="utf-8")
    import numpy as np
    import sounddevice as sd
    from transformers import pipeline
except Exception as e:  # noqa: BLE001 — her eksik paket kullanıcıya adıyla söylenmeli
    yaz(olay="hata", hata=f"paket eksik/yuklenemedi: {e}")
    sys.exit(1)

try:
    pipe = pipeline("automatic-speech-recognition", model=MODEL)
    mikrofon = sd.query_devices(kind="input")["name"]
    IPUCU_ACIK = os.environ.get("ORION_STT_IPUCU", "1") != "0"
    IPUCU_KIMLIK = pipe.tokenizer.get_prompt_ids(IPUCU, return_tensors="pt") if IPUCU_ACIK else None
except Exception as e:  # noqa: BLE001
    yaz(olay="hata", hata=f"model/mikrofon: {e} (model indirilmemis olabilir: python tools/whisper-indir.py)")
    sys.exit(1)

parcalar = []
kayitta = threading.Event()


def geri(veri, _kare, _zaman, _durum):
    if kayitta.is_set():
        parcalar.append(veri[:, 0].copy())


def coz(a):
    """16 kHz float32 diziyi Türkçe metne çevirir (test araçları da bunu kullanır)."""
    # Çok kısa kayıtlar (≈1 sn komut) Whisper'da Türkçe dışına kayıyordu ("see you later"): iki yana sessizlik eklemek bağlamı rahatlatır.
    # Süre ORION_STT_DOLGU (sn, varsayılan 0,5); 0 kapatır.
    dolgu = np.zeros(int(HIZ * float(os.environ.get("ORION_STT_DOLGU", "0.5"))), dtype=a.dtype)
    a = np.concatenate([dolgu, a, dolgu])
    # Çıktı uzunluğu kayıt süresine bağlı: ipuçlu kısa komutta kod çözücü TEKRAR DÖNGÜSÜNE girip ("gündüz yap. gündüz yap. …") 448 jetona kadar
    # gidiyordu (CPU'da 60–77 sn, ölçüldü). Konuşma saniyede ~3–4 jeton; payla birlikte tavan: 8·sn + 12 (en çok 120).
    gk = {"language": "turkish", "task": "transcribe", "max_new_tokens": int(min(120, 8 * len(a) / HIZ + 12))}
    if IPUCU_ACIK:
        gk["prompt_ids"] = IPUCU_KIMLIK
    return pipe({"raw": a, "sampling_rate": HIZ}, generate_kwargs=gk)["text"].strip()


if __name__ == "__main__":
    akis = sd.InputStream(samplerate=HIZ, channels=1, dtype="float32", callback=geri)
    akis.start()
    yaz(olay="hazir", mikrofon=mikrofon, model=MODEL)

    for satir in sys.stdin:
        k = satir.strip().lower()
        if k == "cik":
            break
        if k == "kayit":
            parcalar.clear()
            kayitta.set()
        elif k == "dur":
            kayitta.clear()
            if not parcalar:
                yaz(olay="bos", neden="cok kisa")
                continue
            a = np.concatenate(parcalar)
            sure, tepe = len(a) / HIZ, float(np.abs(a).max())
            if sure < EN_KISA_SN:
                yaz(olay="bos", neden="cok kisa")
                continue
            if tepe < SESSIZ_TEPE:
                yaz(olay="bos", neden="sessiz")
                continue
            if not konusma_var_mi(a):
                yaz(olay="bos", neden="gurultu")
                continue
            try:
                t = time.time()
                metin = coz(a)
                if hayalet_mi(metin):
                    yaz(olay="bos", neden="hayalet")
                    continue
                yaz(olay="tanima", metin=metin, ms=round((time.time() - t) * 1000), sure=round(sure, 2), tepe=round(tepe, 3))
            except Exception as e:  # noqa: BLE001
                yaz(olay="hata", hata=f"cozme: {e}")

    akis.stop()
