# KAYIT (armatür uzayı pozlar) -> FK aksiyon; IK kaldır
def bake(ad,KAYIT,dongu=True):
    for b_ in pb:
        for c in list(b_.constraints): b_.constraints.remove(c)
    a=yeni_aksiyon(ad)
    for f,K in enumerate(KAYIT):
        for n,P in K.items():
            b=arm.bones[n]
            if b.parent: Mb=(b.parent.matrix_local.inverted()@b.matrix_local).inverted()@(K[b.parent.name].inverted()@P)
            else: Mb=b.matrix_local.inverted()@P
            loc,rot,_=Mb.decompose()
            pbn=pb[n]; pbn.rotation_mode='XYZ'; pbn.rotation_euler=rot.to_euler('XYZ')
            pbn.keyframe_insert("rotation_euler",frame=f,group=n)
            if n=="hips": pbn.location=loc; pbn.keyframe_insert("location",frame=f,group=n)
    # euler sürekliliği
    for fc in _fcurves(a):
        if fc.data_path.endswith("rotation_euler"):
            ks=fc.keyframe_points
            for i in range(1,len(ks)):
                d=ks[i].co[1]-ks[i-1].co[1]
                while d>math.pi: ks[i].co[1]-=2*math.pi; d-=2*math.pi
                while d<-math.pi: ks[i].co[1]+=2*math.pi; d+=2*math.pi
            fc.update()
    if dongu: dongusel(a)
    return a
