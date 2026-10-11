#!/bin/bash
# Elle deneme: ikinci, yalıtılmış Orion. Token harcamaz (beyin = yerel hizmet; Haiku adaptörü kapalı).
cd /c/Users/ozigo/3dorion
S=tools/soz-siniflandirma/sonuc
PYTHONIOENCODING=utf-8 brain-lab/laya/.venv/Scripts/python tools/soz-siniflandirma/hizmet.py --port 4710 --gunluk $S/el-dusun.jsonl > $S/el-hizmet.log 2>&1 &
for i in $(seq 1 40); do curl -s -m 1 localhost:4710/saglik >/dev/null && break; sleep 0.25; done
ORION_CLAUDE_BEYIN=0 ORION_MCP_PORT=4810 ORION_BEYIN=dis ORION_BEYIN_ADRES=http://127.0.0.1:4710 \
ORION_HAFIZA_DOSYASI="C:/Users/ozigo/3dorion/$S/el-hafiza.json" ORION_KARAR_DOSYASI="C:/Users/ozigo/3dorion/$S/el-karar.jsonl" \
npx electron . > $S/el-electron.log 2>&1
kill %1 2>/dev/null
