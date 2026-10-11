# Blender içinde exec: `yuru` klibinde diz sapması. Diz, kalça→bilek hattının
# ÖNÜNDE olmalı (menteşe öne büker); yana (x) sapma = içe/dışa çökme.
import bpy, math
from mathutils import Vector
rig=bpy.data.objects["orion_rig"]; pb=rig.pose.bones; sc=bpy.context.scene
rig.animation_data.action=bpy.data.actions[AKSIYON]
try:
    if rig.animation_data.action_slot is None: rig.animation_data.action_slot=bpy.data.actions[AKSIYON].slots[0]
except Exception: pass
satir=[]
bas,son=[int(v) for v in bpy.data.actions[AKSIYON].frame_range]
for f in range(bas,son+1):
    sc.frame_set(f)
    for s,sg in (("left",1),("right",-1)):
        h=pb[s+"UpperLeg"].head; k=pb[s+"UpperLeg"].tail; a=pb[s+"LowerLeg"].tail
        e=(a-h).normalized(); p=h+e*(k-h).dot(e); d=k-p        # dizin hattan sapma vektörü
        bukum=math.degrees((k-h).angle(a-k)) if (k-h).length and (a-k).length else 0
        # sapmanın yana (dışa + / içe -) ve öne (+) bileşenleri
        satir.append((f,s,round(bukum,1),round(d.x*sg*100,1),round(-d.y*100,1)))
result={"satir":satir}
