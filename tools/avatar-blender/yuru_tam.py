exec(open(BETIK+"/anim.py").read().split("# ---------- BOSTA")[0])
exec(open(BETIK+"/bake.py").read())
exec(open(BETIK+"/ik_analitik.py").read())
rig.animation_data.action=None
exec(open(BETIK+"/yuru.py").read())
bake("yuru",KAYIT)
result={"kemik":len(arm.bones),"pelvis":[round(min(yuk),3),round(max(yuk),3)]}
