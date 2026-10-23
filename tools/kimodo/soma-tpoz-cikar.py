# tools/kimodo/soma-tpoz-cikar.py — SOMA77 STANDART T-POZ TABLOSUNU Kimodo deposundan çıkarır (spec 37). Bir kez koşulur; çıktı repoda: somaTpoz.json.
#
# NEDEN: Kimodo'nun BVH'si "BONES-SEED" dinlenme kuralıyla yazılır (exports/bvh.py `from_standard_tpose`): sıfır dönmede iskelet anatomik bir
# duruş DEĞİLDİR (her kemik kendi yerel +X'i boyunca; Spine1 OFFSET'i +X'te). Eklemin dünya dönmesi G_bvh = G_std · O (O = standart T-pozun küresel
# dönme ofseti, `standard_t_pose_global_offsets_rots.p`). Çevirici T-pozdan dünya farkını Δ = G_bvh · Oᵀ ile bulur; O bu dosyadadır.
# Konumlar (`joints.p`, metre, kalça kökenli) T-pozun kemik yönlerini verir (dinlenme hizalaması ve zincir uzunlukları).
#
# Koşma (GPU gerekmez, yalnız torch.load):
#   C:\Users\ozigo\kimodo-deneme\venv\Scripts\python.exe -I tools/kimodo/soma-tpoz-cikar.py <kimodo-repo>/kimodo/assets/skeletons/somaskel77 <bir.bvh> tools/kimodo/somaTpoz.json
# Eklem adları ve sırası BVH başlığından okunur (NPZ/torch sırası = BVH sırası; doğrulama: tools/kimodo/kimodoCevir.test.ts T-poz bekçisi).
import json
import sys

import numpy as np
import torch

klasor, bvh, cikis = sys.argv[1], sys.argv[2], sys.argv[3]
ofset = torch.load(klasor + "/standard_t_pose_global_offsets_rots.p").squeeze().numpy()
konum = torch.load(klasor + "/joints.p").squeeze().numpy()
adlar = []
for satir in open(bvh, encoding="utf-8"):
    s = satir.strip().split()
    if s and s[0] == "JOINT":
        adlar.append(s[1])
assert len(adlar) == ofset.shape[0] == konum.shape[0] == 77, (len(adlar), ofset.shape, konum.shape)
tablo = {
    "kaynak": "kimodo/assets/skeletons/somaskel77 (standard_t_pose_global_offsets_rots.p, joints.p)",
    "aciklama": "ofset: 3x3 satır-ana, sütun-vektör kuralı, SOMA ekseni (Y yukarı, +Z ileri, +X karakterin SOLU); konum: metre, kalça kökenli",
    "eklemler": {a: {"ofset": [round(float(v), 6) for v in ofset[i].reshape(-1)], "konum": [round(float(v), 6) for v in konum[i]]} for i, a in enumerate(adlar)},
}
with open(cikis, "w", encoding="utf-8", newline="\n") as f:
    # Okunur biçim: eklem başına bir satır.
    f.write("{\n" + f'"kaynak": {json.dumps(tablo["kaynak"])},\n"aciklama": {json.dumps(tablo["aciklama"], ensure_ascii=False)},\n"eklemler": {{\n')
    f.write(",\n".join(f"{json.dumps(a)}: {json.dumps(v)}" for a, v in tablo["eklemler"].items()))
    f.write("\n}\n}\n")
print(cikis, len(adlar), "eklem")
