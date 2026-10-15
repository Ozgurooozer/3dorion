# tools/whisper-indir.py — Türkçe kulağın (tools/whisper-dinle.py) modelini BİR KEZ indirir (HuggingFace önbelleğine).
# Kullanım: python tools/whisper-indir.py [model]      (varsayılan ORION_STT_MODEL ya da openai/whisper-base)
# Neden ayrı: tanıyıcı çalışma anında indirmez (ilk V basışında dakikalarca donmasın); eksikse hata mesajı bu betiği söyler.
# Yalnız gerekli dosyalar çekilir (safetensors + yapılandırma/dizgeçler); tf/flax/onnx kopyaları indirilmez.
import os
import sys

from huggingface_hub import snapshot_download

model = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("ORION_STT_MODEL", "openai/whisper-base")
yol = snapshot_download(model, allow_patterns=["*.json", "*.txt", "model.safetensors", "merges.txt", "vocab.json", "tokenizer*"])
print(f"indirildi: {model} -> {yol}")
