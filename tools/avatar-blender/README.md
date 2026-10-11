# avatar-blender — Orion low-poly bedeninin kaynağı

`assets/kaynak/orion-lowpoly.blend` → `assets/orion-lowpoly.glb`. Betikler Blender
İÇİNDE, Blender MCP eklentisinin soketi (127.0.0.1:9876) üzerinden koşar
(`blender_istemci.py`).

## Klipleri yeniden üret (süre/mesafe değişince)

    python tools/avatar-blender/klipler.py

`yuru` (analitik IK, ayak zeminde 1.25 m/s geri akar, basma ortasında diz ~5°) → `bosta`/`otur`/`oturuyor`/`kalk`
(analitik iki-kemik IK) → yürüme ölçümü → GLB export. `otur`/`kalk` süreleri
`world/avatar/yurutucu.ts`den okunur; ayak telafisi `OTURMA_ADIMI`ndan saparsa uyarır.

## Beden ve iskelet (bir kez yapıldı, .blend içinde)

Kaynak mesh: Blender Studio *Human Base Meshes* v1.4.1 (CC0), `GEO-body_male_realistic`,
multires lv2 → decimate ~5k üçgen, flat shading.

| Betik | İş |
|---|---|
| `kesit_yardim.py` | mesh'i düzlemle keser; her halkanın merkezi/yarıçapı |
| `parmak.py`, `eklem.py` | eklemleri kesit merkezlerinden ölçer (içeride-mi denetimli) |
| `iskelet_kur.py` | 52 kemik, VRM humanoid adları, tutarlı roll (menteşe = yerel X) |
| `agirlik.py`, `aktar.py` | ısı ağırlığı yoğun base mesh'te → low-poly'ye aktarım, 4 etki |
| `kareler.py`, `kare_seridi.py`, `yuru_olc.py`, `otur_coz.py` | görsel/ölçüm denetimi |
| `diz_olc.py` | diz büküm açısı + kalça→bilek hattından sapma (öne +, yana); geriye kırılan diz burada görünür |

Sıra: `kesit_yardim` → `parmak` → `eklem` → `iskelet_kur` → `agirlik` → `aktar`
(aynı Blender oturumunda, bir öncekinin tanımlarına bağlı).
