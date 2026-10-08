# tools/mikrofon-dene.py — Mikrofon + Nemotron Speech (EN) elle deneme araci.
#
# Enter'a bas, Ingilizce konus; model ne duydugunu yazar. Orion'a baglanmaz: yalnizca
# "mikrofon calisiyor mu, model beni dogru duyuyor mu" sorusunu yanitlar.
# Calistirma: Masaustundeki "Orion Mikrofon Deneme.bat"
#   komutlar:  Enter = kayit · s <sn> = sure (varsayilan 4) · l = aygit listesi · q = cik
import sys
import time

try:
    import numpy as np
    import sounddevice as sd
    from transformers import pipeline
except ImportError as e:
    print(f"EKSIK PAKET: {e.name}\n  pip install sounddevice librosa transformers torch")
    sys.exit(1)

HIZ = 16000

print("model yukleniyor (ilk seferde indirilir, ~1 dk)...", flush=True)
pipe = pipeline("automatic-speech-recognition", model="nvidia/nemotron-speech-streaming-en-0.6b")
try:
    print("mikrofon:", sd.query_devices(kind="input")["name"], flush=True)
except Exception as e:
    print("MIKROFON YOK / ACILAMADI:", e)
    sys.exit(1)

sure = 4.0
print("\nIngilizce konus. Enter = kayit | s 6 = sure 6 sn | l = aygitlar | q = cik")
while True:
    k = input("\n> ").strip().lower()
    if k == "q":
        break
    if k == "l":
        print(sd.query_devices())
        continue
    if k.startswith("s "):
        try:
            sure = float(k[2:])
            print(f"sure = {sure} sn")
        except ValueError:
            print("sayi gir: s 6")
        continue
    print("KONUS...", flush=True)
    a = sd.rec(int(sure * HIZ), samplerate=HIZ, channels=1, dtype="float32")
    sd.wait()
    a = a[:, 0]
    tepe, rms = float(np.abs(a).max()), float(np.sqrt((a ** 2).mean()))
    uyari = "  <-- COK DUSUK, mikrofon seviyesine bak" if tepe < 0.02 else ""
    print(f"seviye: tepe={tepe:.3f} rms={rms:.4f}{uyari}")
    t = time.time()
    metin = pipe(a)["text"]
    print(f"DUYDUM: {metin!r}   ({time.time() - t:.2f} sn)")
