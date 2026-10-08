# tools/nemotron-dinle.py — Orion'un kulağı: mikrofon + Nemotron Speech (EN), kalıcı süreç.
#
# host/dinleme.js bunu başlatır. Model bir kez yüklenir (~4 sn), sonra bas-konuş:
#   stdin  (satır):  kayit  → mikrofonu kaydetmeye başla
#                    dur    → kaydı bitir, çöz, sonucu yaz
#                    cik    → çık
#   stdout (JSON satırı, UTF-8):
#     {"olay":"hazir","mikrofon":"..."}
#     {"olay":"tanima","metin":"...","ms":812,"sure":2.4,"tepe":0.31}
#     {"olay":"bos","neden":"cok kisa|sessiz"}      ← çözülmedi, uydurma metin üretilmez
#     {"olay":"hata","hata":"..."}
# Ses dosyaya ya da ağa gitmez; yalnız bellekte durur. Orion'a bağlanma işi host/dinleme.js'te.
import json
import sys
import threading
import time

HIZ = 16000
EN_KISA_SN = 0.3     # bundan kısa kayıt tuş titremesidir
SESSIZ_TEPE = 0.01   # bunun altı: mikrofon duymadı; model sessizliğe kelime uydurur ("Madhuba.")


def yaz(**kv):
    sys.stdout.write(json.dumps(kv, ensure_ascii=False) + "\n")
    sys.stdout.flush()


try:
    sys.stdout.reconfigure(encoding="utf-8")
    import numpy as np
    import sounddevice as sd
    from transformers import pipeline
except Exception as e:  # noqa: BLE001 — her eksik paket kullanıcıya adıyla söylenmeli
    yaz(olay="hata", hata=f"paket eksik/yuklenemedi: {e}")
    sys.exit(1)

try:
    pipe = pipeline("automatic-speech-recognition", model="nvidia/nemotron-speech-streaming-en-0.6b")
    mikrofon = sd.query_devices(kind="input")["name"]
except Exception as e:  # noqa: BLE001
    yaz(olay="hata", hata=f"model/mikrofon: {e}")
    sys.exit(1)

parcalar = []
kayitta = threading.Event()


def geri(veri, _kare, _zaman, _durum):
    if kayitta.is_set():
        parcalar.append(veri[:, 0].copy())


akis = sd.InputStream(samplerate=HIZ, channels=1, dtype="float32", callback=geri)
akis.start()
yaz(olay="hazir", mikrofon=mikrofon)

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
        try:
            t = time.time()
            metin = pipe(a)["text"].strip()
            yaz(olay="tanima", metin=metin, ms=round((time.time() - t) * 1000), sure=round(sure, 2), tepe=round(tepe, 3))
        except Exception as e:  # noqa: BLE001
            yaz(olay="hata", hata=f"cozme: {e}")

akis.stop()
