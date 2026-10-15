# tools/stt-olc.py — Türkçe kulak ölçümü (docs/olcum/on-kayit-stt-turkce-1.md: S1–S5). SENTETİK ses: ÜST SINIR, gerçek mikrofon değil.
# Piper tr_TR-dfki-medium ile cümleler sentezlenir, tanıyıcıdan (tools/whisper-dinle.py'nin `coz` işlevi) geçirilir, sonuç JSON'a yazılır;
# komut tutarlılığı (S1) tools/stt-karar.ts ile ayrıca sınanır (komutCoz TypeScript'te).
# Kullanım: python tools/stt-olc.py [çıktı.json]
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import time
import wave

import numpy as np

KOK = os.path.dirname(os.path.abspath(__file__))
PIPER = os.path.join(os.path.expanduser("~"), "AppData", "Local", "piper", "piper", "piper.exe")
SES = os.path.join(os.path.expanduser("~"), "AppData", "Local", "piper", "sesler", "tr_TR-dfki-medium.onnx")

# (tür, söz): "komut" = Orion'un LLM'siz tanıdığı söz olmalı; "sohbet" = serbest cümle.
CUMLELER = [
    ("komut", "otur"), ("komut", "yanıma gel"), ("komut", "takip et"), ("komut", "gece yap"), ("komut", "gündüz yap"),
    ("komut", "pastel yap"), ("komut", "zamanı durdur"), ("komut", "zaman aksın"), ("komut", "ışığı kıs"), ("komut", "sis aç"),
    ("komut", "bloom kapat"), ("komut", "bana gel"),
    ("sohbet", "ne görüyorsun"), ("sohbet", "neredesin orion"), ("sohbet", "şimdi ne yapıyorsun"), ("sohbet", "daha önce ne konuştuk"),
    ("sohbet", "tahtaya git ve bir şey yaz"), ("sohbet", "pencereden dışarıda ne var"), ("sohbet", "bugün hava nasıl görünüyor"),
    ("sohbet", "bana kendini tanıt"), ("sohbet", "terminalde ne yazıyor"), ("sohbet", "masaya otur ve monitörü aç"),
    ("sohbet", "hafızanda neler var"), ("sohbet", "kapıdan dışarı çık ve geri gel"),
]


def sentezle(metin, yol):
    subprocess.run([PIPER, "--model", SES, "--output_file", yol], input=metin.encode("utf-8"), check=True, capture_output=True)
    with wave.open(yol, "rb") as w:
        hiz, ham = w.getframerate(), w.readframes(w.getnframes())
    a = np.frombuffer(ham, dtype=np.int16).astype(np.float32) / 32768.0
    if hiz != 16000:  # doğrusal yeniden örnekleme (ölçüm için yeterli)
        n = int(len(a) * 16000 / hiz)
        a = np.interp(np.linspace(0, len(a) - 1, n), np.arange(len(a)), a).astype(np.float32)
    return a


def normal(m):
    m = m.lower().replace("İ", "i").replace("I", "ı")
    return " ".join("".join(c if c.isalnum() or c.isspace() else " " for c in m).split())


def wer(ref, hip):
    r, h = normal(ref).split(), normal(hip).split()
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        onceki, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            gecici = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, onceki + (r[i - 1] != h[j - 1]))
            onceki = gecici
    return d[len(h)] / max(1, len(r))


def yukle_kulak():
    spec = importlib.util.spec_from_file_location("kulak", os.path.join(KOK, "whisper-dinle.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def main():
    cikti = sys.argv[1] if len(sys.argv) > 1 else os.path.join(tempfile.gettempdir(), "stt-olc.json")
    t = time.time()
    kulak = yukle_kulak()
    yukleme = time.time() - t
    kulak.coz(np.zeros(16000, dtype=np.float32) + 0.001)  # ısınma (ilk çağrı yavaş)
    rng = np.random.default_rng(7)
    sonuc = {"model": kulak.MODEL, "yukleme_sn": round(yukleme, 1), "cumleler": [], "sessiz": []}
    with tempfile.TemporaryDirectory() as tmp:
        for i, (tur, soz) in enumerate(CUMLELER):
            a = sentezle(soz, os.path.join(tmp, f"{i}.wav"))
            t0 = time.time()
            hip = kulak.coz(a)
            ms = round((time.time() - t0) * 1000)
            sonuc["cumleler"].append({"tur": tur, "ref": soz, "hyp": hip, "ms": ms, "sure": round(len(a) / 16000, 2), "wer": round(wer(soz, hip), 3)})
            print(f"{tur:6} {ms:5d} ms  {len(a)/16000:4.1f}s  wer={wer(soz, hip):.2f}  {soz!r} -> {hip!r}", flush=True)
    # Sessizlik/gürültü: ürünün TÜM koruması (kısa kayıt, tepe eşiği, çözüm, hayalet süzgeci) bire bir uygulanır.
    ornek = lambda n: np.zeros(int(16000 * n), dtype=np.float32)
    gurultu = [
        ("sessizlik 2 sn", ornek(2)),
        ("beyaz gürültü 0,02", (rng.standard_normal(32000) * 0.02).astype(np.float32)),
        ("kısık gürültü 0,012", (rng.standard_normal(48000) * 0.012).astype(np.float32)),
        ("50 Hz uğultu 0,03", (0.03 * np.sin(2 * np.pi * 50 * np.arange(48000) / 16000)).astype(np.float32)),
        ("tık 0,2 sn", np.concatenate([np.array([0.5, -0.5] * 800, dtype=np.float32), ornek(0.01)])),
        ("klavye darbeleri", np.where(rng.random(48000) > 0.998, 0.4, 0.0).astype(np.float32)),
    ]
    for ad, a in gurultu:
        sure, tepe = len(a) / 16000, float(np.abs(a).max())
        if sure < kulak.EN_KISA_SN:
            karar = "bos:cok kisa"
        elif tepe < kulak.SESSIZ_TEPE:
            karar = "bos:sessiz"
        elif not kulak.konusma_var_mi(a):
            karar = "bos:gurultu"
        else:
            m = kulak.coz(a)
            karar = "bos:hayalet" if kulak.hayalet_mi(m) else f"METIN:{m!r}"
        sonuc["sessiz"].append({"ad": ad, "tepe": round(tepe, 4), "karar": karar})
        print(f"gürültü {ad:22} tepe={tepe:.3f} -> {karar}", flush=True)
    try:
        import psutil
        sonuc["ram_mb"] = round(psutil.Process().memory_info().rss / 1048576)
    except Exception:  # noqa: BLE001
        sonuc["ram_mb"] = None
    with open(cikti, "w", encoding="utf-8") as f:
        json.dump(sonuc, f, ensure_ascii=False, indent=1)
    wers = [c["wer"] for c in sonuc["cumleler"]]
    print(f"ORTALAMA WER {np.mean(wers):.3f} | medyan çözme {int(np.median([c['ms'] for c in sonuc['cumleler']]))} ms | yükleme {sonuc['yukleme_sn']} sn | RAM {sonuc['ram_mb']} MB -> {cikti}")


main()
