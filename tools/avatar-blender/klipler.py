"""Orion low-poly bedeninin animasyon kliplerini Blender'da yeniden üretir ve GLB'ye yazar.

Önkoşul: Blender açık, `assets/kaynak/orion-lowpoly.blend` yüklü, Blender MCP
eklentisi 127.0.0.1:9876'da dinliyor.

    python tools/avatar-blender/klipler.py            # yuru + diğerleri + ölçüm + export
    python tools/avatar-blender/klipler.py yuru olc   # yalnızca seçilen adımlar

Klip süreleri ELLE yazılmaz: `world/avatar/yurutucu.ts`deki OTURMA_SURESI /
KALKMA_SURESI'nden türetilir. Klipteki ayak telafisi (ayakta bilek → oturmuş
bilek) OTURMA_ADIMI'ndan saparsa bu betik UYARIR — ikisi ayrışırsa oyunda
ayak kayar (bkz. yurutucu.ts OTURMA_ADIMI yorumu).
"""
import json, os, re, sys, tempfile
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(__file__))
from blender_istemci import send

KOK = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BETIK = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
CIKTI = tempfile.mkdtemp(prefix="avatar-blender-").replace("\\", "/")
GLB = os.path.join(KOK, "assets", "orion-lowpoly.glb").replace("\\", "/")
FPS = 30

ts = open(os.path.join(KOK, "world", "avatar", "yurutucu.ts"), encoding="utf-8").read()
def sabit(ad):
    m = re.search(rf"export const {ad} = ([0-9.]+);", ts)
    if not m: sys.exit(f"yurutucu.ts içinde {ad} bulunamadı")
    return float(m.group(1))
OTUR_KARE = round(sabit("OTURMA_SURESI") * FPS)
KALK_KARE = round(sabit("KALKMA_SURESI") * FPS)
OTURMA_ADIMI = sabit("OTURMA_ADIMI")

ONSOZ = (f'BETIK=r"{BETIK}"\nCIKTI=r"{CIKTI}"\nGLB=r"{GLB}"\n'
         f"OTUR_KARE={OTUR_KARE}\nKALK_KARE={KALK_KARE}\n"
         'import bpy\nif not bpy.data.filepath.replace("\\\\","/").endswith("orion-lowpoly.blend"):\n'
         '    raise RuntimeError("Blender\'da assets/kaynak/orion-lowpoly.blend açık değil: "+bpy.data.filepath)\n')
def ex(ad, *dosyalar, parca=None):
    kod = ONSOZ
    for d in dosyalar:
        kod += f'exec(open(BETIK+"/{d}").read(){parca.get(d, "") if parca else ""})\n'
    r = send(kod)
    if r.get("status") != "ok":
        sys.exit(f"[{ad}] HATA:\n{r.get('message')}")
    return r.get("result", {})

ADIMLAR = sys.argv[1:] or ["yuru", "diger", "olc", "export"]
if "yuru" in ADIMLAR:
    print("[yuru]", json.dumps(ex("yuru", "yuru_tam.py")))
if "diger" in ADIMLAR:
    r = ex("diger", "anim.py", "bake.py", "ik_analitik.py", "klipler_ik.py",
           parca={"anim.py": '.split("# ---------- BOSTA")[0]'})
    print("[diger]", json.dumps(r))
    if abs(r["D"] - OTURMA_ADIMI) > 0.02:
        print(f"UYARI: klip ayak telafisi D={r['D']} ama yurutucu.ts OTURMA_ADIMI={OTURMA_ADIMI} — ayak kayar!")
if "olc" in ADIMLAR:
    satir = ex("olc", "yuru_olc.py")["f_solz_soly_sagz_sagy"]
    basan = [min(s[1], s[3]) for s in satir]
    print(f"[olc] yürüme: basan ayak z aralığı {min(basan):.3f}..{max(basan):.3f} (dinlenme tabanı -0.006)")
if "export" in ADIMLAR:
    print("[export]", json.dumps(ex("export", "disa_aktar.py")), "->", GLB)
