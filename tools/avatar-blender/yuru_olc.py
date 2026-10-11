exec(open(BETIK+"/anim_ortak.py").read())
rig.animation_data.action=bpy.data.actions["yuru"]
sol=(_rest[:,2]<0.1)&(_rest[:,0]>0); sag=(_rest[:,2]<0.1)&(_rest[:,0]<0)
satir=[]
for f in range(0,36):
    sc.frame_set(f)
    _,_,P=olc()
    L=P[sol]; Rr=P[sag]
    satir.append((f, round(float(L[:,2].min()),3), round(float(L[np.argmin(L[:,2])][1]),3), round(float(Rr[:,2].min()),3), round(float(Rr[np.argmin(Rr[:,2])][1]),3)))
result={"f_solz_soly_sagz_sagy":satir}
