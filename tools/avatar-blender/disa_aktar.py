# Blender içinde exec edilir (klipler.py). Beş aksiyonu NLA izine koyup GLB'ye yazar.
import bpy, os
sc=bpy.context.scene; vl=bpy.context.view_layer
rig=bpy.data.objects["orion_rig"]; govde=bpy.data.objects["orion_govde"]
rig.animation_data.action=None
for b in rig.pose.bones:
    b.rotation_mode='XYZ'; b.rotation_euler=(0,0,0); b.rotation_quaternion=(1,0,0,0); b.location=(0,0,0)
ad=rig.animation_data
for t in list(ad.nla_tracks): ad.nla_tracks.remove(t)
for n in ("bosta","yuru","otur","oturuyor","kalk"):
    a=bpy.data.actions[n]; tr=ad.nla_tracks.new(); tr.name=n
    tr.strips.new(n,int(a.frame_range[0]),a); tr.mute=True
for x in vl.objects: x.select_set(False)
rig.select_set(True); govde.select_set(True); vl.objects.active=rig
with bpy.context.temp_override(active_object=rig,object=rig,selected_objects=[rig,govde]):
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True,
        export_yup=True, export_apply=False, export_skins=True, export_def_bones=True,
        export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True,
        export_frame_step=1, export_morph=False, export_materials='EXPORT', export_extras=False)
bpy.ops.wm.save_mainfile()
result={"glb_kb":os.path.getsize(GLB)//1024}
