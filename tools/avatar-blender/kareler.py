exec(open(BETIK+"/pozlar.py").read())
import os
def kareler(aksiyon, kareler, aci, onek, yuk=0.9, olcek=1.95):
    rig.animation_data.action=bpy.data.actions[aksiyon]
    try:
        if rig.animation_data.action_slot is None: rig.animation_data.action_slot=bpy.data.actions[aksiyon].slots[0]
    except Exception: pass
    out=[]
    for f in kareler:
        sc.frame_set(f)
        cam=bpy.data.objects["onizleme_kam"]; a=R(aci)
        cam.location=(6*math.sin(a),-6*math.cos(a),yuk); cam.rotation_euler=(R(90),0,a); cam.data.ortho_scale=olcek
        sc.render.engine='BLENDER_WORKBENCH'; sc.render.resolution_x=300; sc.render.resolution_y=420
        p=CIKTI+"/%s_%03d.png"%(onek,f); sc.render.filepath=p; bpy.ops.render.render(write_still=True); out.append(p)
    return out
