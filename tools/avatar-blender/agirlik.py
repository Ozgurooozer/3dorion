import bpy
sc=bpy.context.scene; vl=bpy.context.view_layer
rig=bpy.data.objects["orion_rig"]; govde=bpy.data.objects["orion_govde"]
for n in ("agirlik_kaynak",):
    o=bpy.data.objects.get(n)
    if o: bpy.data.objects.remove(o,do_unlink=True)
src=bpy.data.objects["GEO-body_male_realistic"]; m=src.modifiers[0]; e=m.levels; m.levels=1
dg=bpy.context.evaluated_depsgraph_get(); me=bpy.data.meshes.new_from_object(src.evaluated_get(dg)); m.levels=e
me.transform(src.matrix_world); me.name="agirlik_kaynak"
ks=bpy.data.objects.new("agirlik_kaynak",me); sc.collection.objects.link(ks)
for x in vl.objects: x.select_set(False)
ks.select_set(True); rig.select_set(True); vl.objects.active=rig
with bpy.context.temp_override(active_object=rig,object=rig,selected_objects=[ks,rig],selected_editable_objects=[ks,rig]):
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
bos=sum(1 for v in me.vertices if not v.groups)
# bos grup (kemiği hiç etkilemeyen) var mı
dolu={g.index:0 for g in ks.vertex_groups}
for v in me.vertices:
    for g in v.groups:
        if g.weight>0.05: dolu[g.group]+=1
result={"v":len(me.vertices),"agirliksiz":bos,"bos_kemik":[ks.vertex_groups[i].name for i,c in dolu.items() if c==0]}
