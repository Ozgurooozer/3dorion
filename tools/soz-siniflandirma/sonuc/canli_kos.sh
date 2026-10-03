#!/bin/bash
cd /c/Users/ozigo/3dorion
S=tools/soz-siniflandirma/sonuc
PYTHONIOENCODING=utf-8 brain-lab/laya/.venv/Scripts/python tools/soz-siniflandirma/hizmet.py --port 4700 --gunluk $S/canli-dusun.jsonl > $S/canli-hizmet.log 2>&1 &
HPID=$!
for i in $(seq 1 40); do curl -s -m 1 localhost:4700/saglik >/dev/null && break; sleep 0.25; done
echo "BASLA $(date +%s%3N)" > $S/canli-zaman.txt
SOZ="sandalyenin yanına git@2500|tahtaya bir şiir yaz@2500|odada ne var@2500|günün nasıl geçiyor@2500|sakın oturma@2500|buraya gel@2500|ayağa kalk@2500|tahtada ne yazıyor@2500|iyi akşamlar@2500|bak@2500|go next to the table@2500|write welcome on the board@2500|where is the window@2500|how is your day going@2500|do not sit down@2500|come over here@2500|get up@2500|what do you see now@2500|good evening@2500|go@2500"
ORION_BECERDENE=1 ORION_SMOKE=1 ORION_SMOKE_MS=68000 ORION_BEYIN=dis ORION_BEYIN_ADRES=http://127.0.0.1:4700 \
ORION_HAFIZA_DOSYASI="C:/Users/ozigo/3dorion/$S/canli-hafiza.json" ORION_KARAR_DOSYASI="C:/Users/ozigo/3dorion/$S/canli-karar.jsonl" \
ORION_BECERDENE_SOZLER="$SOZ" npx electron . > $S/canli-electron.log 2>&1
echo "ELECTRON-CIKIS $? $(date +%s%3N)" >> $S/canli-zaman.txt
kill $HPID 2>/dev/null
echo BITTI >> $S/canli-zaman.txt
