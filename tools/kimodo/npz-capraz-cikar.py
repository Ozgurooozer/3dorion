# tools/kimodo/npz-capraz-cikar.py — ÇAPRAZ DOĞRULAMA VERİSİ (spec 37 §4): Kimodo'nun kendi NPZ çıktısından üç karenin eklem konumları ve standart-T-poz
# küresel dönmeleri. TS ayrıştırıcısı + ileri kinematik + T-poz tablosu bunlarla karşılaştırılır (kimodoCevir.test.ts). Bir kez koşulur.
#   C:\Users\ozigo\kimodo-deneme\venv\Scripts\python.exe -I tools/kimodo/npz-capraz-cikar.py <el_salla.npz> <el_salla.bvh> tools/kimodo/test-verisi/el_salla_npz.json
import json
import sys

import numpy as np

npz, bvh, cikis = sys.argv[1], sys.argv[2], sys.argv[3]
d = np.load(npz)
adlar = []
for satir in open(bvh, encoding="utf-8"):
    s = satir.strip().split()
    if s and s[0] == "JOINT":
        adlar.append(s[1])
secili = ["Hips", "Spine1", "Chest", "Neck1", "Head", "RightArm", "RightForeArm", "RightHand", "LeftArm", "LeftHand", "RightLeg", "RightShin", "RightFoot", "LeftFoot"]
kareler = [0, 45, int(d["posed_joints"].shape[0]) - 1]
veri = {"kareler": kareler, "eklemler": {}}
for a in secili:
    i = adlar.index(a)
    veri["eklemler"][a] = {
        "konum": [[round(float(x), 6) for x in d["posed_joints"][k, i]] for k in kareler],
        "kuresel": [[round(float(x), 6) for x in d["global_rot_mats"][k, i].reshape(-1)] for k in kareler],
    }
with open(cikis, "w", encoding="utf-8", newline="\n") as f:
    f.write("{\n" + f'"kareler": {json.dumps(kareler)},\n"eklemler": {{\n')
    f.write(",\n".join(f"{json.dumps(a)}: {json.dumps(v)}" for a, v in veri["eklemler"].items()))
    f.write("\n}\n}\n")
print(cikis)
