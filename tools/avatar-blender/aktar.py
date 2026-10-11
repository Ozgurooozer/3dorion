import bpy
vl=bpy.context.view_layer
rig=bpy.data.objects["orion_rig"]; govde=bpy.data.objects["orion_govde"]; ks=bpy.data.objects["agirlik_kaynak"]
govde.parent=None; govde.modifiers.clear(); govde.vertex_groups.clear()
for g in ks.vertex_groups: govde.vertex_groups.new(name=g.name)
dt=govde.modifiers.new("DT","DATA_TRANSFER"); dt.object=ks
dt.use_vert_data=True; dt.data_types_verts={'VGROUP_WEIGHTS'}; dt.vert_mapping='POLYINTERP_NEAREST'
dt.layers_vgroup_select_src='ALL'; dt.layers_vgroup_select_dst='NAME'
for x in vl.objects: x.select_set(False)
vl.objects.active=govde; govde.select_set(True)
with bpy.context.temp_override(active_object=govde,object=govde,selected_objects=[govde],selected_editable_objects=[govde]):
    bpy.ops.object.modifier_apply(modifier="DT")
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL',limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL',lock_active=False)
    bpy.ops.object.vertex_group_clean(group_select_mode='ALL',limit=0.001)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL',lock_active=False)
am=govde.modifiers.new("Armature","ARMATURE"); am.object=rig
mw=govde.matrix_world.copy(); govde.parent=rig; govde.matrix_world=mw
ks.hide_set(True); ks.hide_render=True
me=govde.data
mx=max(len(v.groups) for v in me.vertices)
tot=[sum(g.weight for g in v.groups) for v in me.vertices]
result={"maks_etki":mx,"agirliksiz":sum(1 for v in me.vertices if not v.groups),"top_min":round(min(tot),3),"top_max":round(max(tot),3)}
