import bpy, math
from mathutils import Vector
R=math.radians
sc=bpy.context.scene; rig=bpy.data.objects["orion_rig"]; pb=rig.pose.bones
def sifirla():
    for b in pb: b.rotation_mode='XYZ'; b.rotation_euler=(0,0,0); b.location=(0,0,0)
def p(ad,x=0,y=0,z=0,ayna=True):
    for s,k in (("left",1),("right",-1)) if ad.startswith("*") else ((None,1),):
        n=ad.replace("*",s) if s else ad
        b=pb[n]; b.rotation_euler=(R(x),R(y)*k,R(z)*k)
def render(ad,aci,yuk=0.9,olcek=1.95,uzak=6):
    cam=bpy.data.objects["onizleme_kam"]; a=R(aci)
    cam.location=(uzak*math.sin(a),-uzak*math.cos(a),yuk); cam.rotation_euler=(R(90),0,a); cam.data.ortho_scale=olcek
    sc.render.engine='BLENDER_WORKBENCH'; sc.render.resolution_x=700; sc.render.resolution_y=900
    sc.render.filepath=CIKTI+"/"+ad+".png"; bpy.ops.render.render(write_still=True)
