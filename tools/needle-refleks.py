# tools/needle-refleks.py — Needle 2 REFLEKS katmanini yapabilir mi?
#
# Olcut acik: KURALLARI GECMELI. Kurallar su an 0 ms'de gercek veride 13/13
# yapiyor. Needle'in isi, kurallarin yapamadigini yapmak - yeni durum
# bilesimlerini - kabul edilebilir maliyetle.
#
# Onceki eleme: functiongemma-270m ayni sinavda cokmustu (31/31 bozuk JSON).
# Ama o GENEL bir sohbet modeliydi; Needle dogrudan arac cagrisi icin yapilmis.
# Fark bu, ve olcmeye deger.
#
# Kullanim: .venv-needle/Scripts/python.exe tools/needle-refleks.py

import json
import time

from needle import Needle, tool

# ── Orion'un REFLEKS araclari (dar kume, bilerek) ─────────────────────────
# Refleks katmani tum dunyayi degil, bedeni yonetir. Dar tutmak hem 256
# token penceresine sigmak hem de yanlis secim olasiligini dusurmek icin.

secilen = []


@tool
def look_at_user() -> str:
    """Turn head toward the user. Use when the user is near and looking at you."""
    secilen.append("look_at_user")
    return "bakildi"


@tool
def release_gaze() -> str:
    """Return to free gaze. Use when the user is far away or not engaged."""
    secilen.append("release_gaze")
    return "birakildi"


@tool
def wave_hello() -> str:
    """Wave. Use ONLY when the user JUST entered the room or just approached."""
    secilen.append("wave_hello")
    return "selamlandi"


@tool
def do_nothing() -> str:
    """Do nothing. Use when nothing changed or no reaction is needed."""
    secilen.append("do_nothing")
    return "beklendi"


SISTEM = (
    "You are the reflex layer of a robot in a room. You receive a sensor "
    "snapshot. Call exactly ONE tool. Do not explain."
)

# ── Sinav: her satir bir sensor anlik goruntusu + beklenen refleks ────────
SINAVLAR = [
    ("User is 1.2 meters away and looking at you. You are standing.", "look_at_user"),
    ("User is 6.4 meters away and not looking at you. Nothing changed.", {"release_gaze", "do_nothing"}),
    ("User JUST entered the room, 2.0 meters away.", {"wave_hello", "look_at_user"}),
    ("User is 5.9 meters away, working at the monitor. Nothing changed.", {"do_nothing", "release_gaze"}),
    ("User is 0.8 meters away, looking at you, and just approached.", {"look_at_user", "wave_hello"}),
    ("User is 3.0 meters away, walking past you, not looking.", {"do_nothing", "release_gaze"}),
]


def main() -> None:
    print("Needle 2 — refleks sinavi")
    t0 = time.time()
    ajan = Needle(tools=[look_at_user, release_gaze, wave_hello, do_nothing], system=SISTEM)
    print(f"  yukleme: {int((time.time() - t0) * 1000)} ms\n")

    dogru = 0
    sureler = []
    for girdi, beklenen in SINAVLAR:
        secilen.clear()
        ajan.reset()
        t = time.time()
        try:
            sonuc = ajan.run(girdi, max_steps=2)
        except Exception as e:  # noqa: BLE001 - sonda; her hatayi gormek istiyoruz
            print(f"  HATA: {girdi[:44]}... -> {type(e).__name__}: {e}")
            continue
        ms = int((time.time() - t) * 1000)
        sureler.append(ms)

        cagrilan = secilen[0] if secilen else None
        kabul = beklenen if isinstance(beklenen, set) else {beklenen}
        gecti = cagrilan in kabul
        if gecti:
            dogru += 1
        ozet = json.dumps(sonuc, ensure_ascii=False)[:70] if isinstance(sonuc, dict) else str(sonuc)[:70]
        print(f"  [{'GECTI' if gecti else 'KALDI'}] {ms:5d} ms  arac={cagrilan}  bekl={sorted(kabul)}")
        print(f"      girdi: {girdi[:66]}")
        if not gecti:
            print(f"      ham : {ozet}")

    ort = int(sum(sureler) / len(sureler)) if sureler else 0
    print(f"\n  --> {dogru}/{len(SINAVLAR)} dogru, ortalama {ort} ms")
    ajan.close()


if __name__ == "__main__":
    main()
