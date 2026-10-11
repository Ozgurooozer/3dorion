import sys,glob
from PIL import Image, ImageDraw
onek=sys.argv[1]; fs=sorted(glob.glob(onek+"_*.png"))
ims=[Image.open(f) for f in fs]; w,h=ims[0].size
S=Image.new("RGB",(w*len(ims),h),(40,40,40))
for i,(f,im) in enumerate(zip(fs,ims)):
    S.paste(im,(i*w,0)); ImageDraw.Draw(S).text((i*w+8,8),f.split("_")[-1][:-4],fill=(255,220,120))
S.save(onek+"_sheet.png")
