# kesit_yardim, parmak, eklem'den sonra exec edilir -> J (sol taraf) hazır.
import numpy as np
from mathutils import Vector
J["leftUpperLeg"][0]=0.088
def x_ortala(p):
    p=Vector(p); h=[]
    for s in (1,-1):
        hit=BVH.ray_cast(p,Vector((s,0,0)),0.05)
        if hit[0] is None: return np.array(p)
        h.append(hit[0].x)
    return np.array((0.5*(h[0]+h[1]),p.y,p.z))
for f in ("Index","Middle","Ring","Little"):
    for s in ("Proximal","Intermediate","Distal"):
        J["left"+f+s]=x_ortala(J["left"+f+s])
sc=bpy.context.scene; vl=bpy.context.view_layer
for n in ("orion_rig",):
    o=bpy.data.objects.get(n)
    if o: bpy.data.objects.remove(o,do_unlink=True)
for a in list(bpy.data.armatures):
    if a.users==0: bpy.data.armatures.remove(a)
govde=bpy.data.objects["orion_govde"]; govde.parent=None; govde.modifiers.clear(); govde.vertex_groups.clear()
arm=bpy.data.armatures.new("orion_rig"); rig=bpy.data.objects.new("orion_rig",arm); sc.collection.objects.link(rig)
arm.display_type='OCTAHEDRAL'; rig.show_in_front=True
def M(p,s):  # aynala
    p=np.array(p,float).copy(); p[0]*=s; return Vector(p)
ONE=(0,-1,0)
B=[]  # (ad, ebeveyn, bas, kuyruk, roll_z_ekseni)
B+=[("hips",None,Vector((0,J["hips"][1],0.93)),Vector(J["spine"]),ONE),
    ("spine","hips",Vector(J["spine"]),Vector(J["chest"]),ONE),
    ("chest","spine",Vector(J["chest"]),Vector(J["upperChest"]),ONE),
    ("upperChest","chest",Vector(J["upperChest"]),Vector(J["neck"]),ONE),
    ("neck","upperChest",Vector(J["neck"]),Vector(J["head"]),ONE),
    ("head","neck",Vector(J["head"]),Vector(J["headTop"]),ONE)]
for side,s in (("left",1),("right",-1)):
    L=lambda k:M(J["left"+k],s)
    palm=(-s,0,0)
    B+=[(side+"UpperLeg","hips",L("UpperLeg"),L("LowerLeg"),ONE),
        (side+"LowerLeg",side+"UpperLeg",L("LowerLeg"),L("Foot"),ONE),
        (side+"Foot",side+"LowerLeg",L("Foot"),L("Toes"),(0,0,1)),
        (side+"Toes",side+"Foot",L("Toes"),L("ToeTip"),(0,0,1)),
        (side+"Shoulder","upperChest",L("Shoulder"),L("UpperArm"),ONE),
        (side+"UpperArm",side+"Shoulder",L("UpperArm"),L("LowerArm"),ONE),
        (side+"LowerArm",side+"UpperArm",L("LowerArm"),L("Hand"),ONE),
        (side+"Hand",side+"LowerArm",L("Hand"),L("MiddleProximal"),palm)]
    for f in ("Thumb","Index","Middle","Ring","Little"):
        B+=[(side+f+"Proximal",side+"Hand",L(f+"Proximal"),L(f+"Intermediate"),palm),
            (side+f+"Intermediate",side+f+"Proximal",L(f+"Intermediate"),L(f+"Distal"),palm),
            (side+f+"Distal",side+f+"Intermediate",L(f+"Distal"),L(f+"Tip"),palm)]
for x in vl.objects: x.select_set(False)
vl.objects.active=rig; rig.select_set(True)
with bpy.context.temp_override(active_object=rig,object=rig,selected_objects=[rig]):
    bpy.ops.object.mode_set(mode='EDIT')
    eb=arm.edit_bones
    for n,p,h,t,z in B:
        b=eb.new(n); b.head=h; b.tail=t; b.align_roll(Vector(z))
    for n,p,h,t,z in B:
        if p:
            eb[n].parent=eb[p]
            eb[n].use_connect=(eb[p].tail-eb[n].head).length<1e-5
    bpy.ops.object.mode_set(mode='OBJECT')
KEMIK=len(arm.bones)
