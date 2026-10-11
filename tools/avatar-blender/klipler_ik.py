rig.animation_data.action=None
ik_kur()
KOL=[b.name for b in arm.bones if b.use_deform and any(k_ in b.name for k_ in ("Shoulder","Arm","Hand","Thumb","Index","Middle","Ring","Little"))]
def sm(u): u=min(1,max(0,u)); return u*u*(3-2*u)
A0=arm.bones["leftFoot"].head_local.copy(); TAB=A0.z+0.006   # bilek-taban
def ayakta_bilek(s): return Vector(((1 if s=="left" else -1)*0.11, A0.y, A0.z))
def yerel(K):
    out={}
    for n,P in K.items():
        b=arm.bones[n]
        out[n]=(b.parent.matrix_local.inverted()@b.matrix_local).inverted()@(K[b.parent.name].inverted()@P) if b.parent else b.matrix_local.inverted()@P
    return out
def kol_uygula(Ba,Bb,u):
    for n in KOL:
        qa=Ba[n].to_quaternion(); qb=Bb[n].to_quaternion()
        pb[n].rotation_mode='QUATERNION'; pb[n].rotation_quaternion=qa.slerp(qb,u)
# ---- ayakta taban (IK ayak) ----
def ayakta_poz(nefes=0,sal=0):
    ayakta()
    el_ik(False)
    konum("hips",yukari=-0.014-0.003*(1+nefes)/2, yan=0.010*sal); k("hips",z=1.0*sal); k("spine",z=-0.7*sal)
    k("chest",x=-1.2*nefes); k("upperChest",x=-1.0*nefes)
    for s in ("left","right"): ayak_ctrl(s,ayakta_bilek(s),0,7)
K_AYAK=None
ayakta_poz(); K_AYAK=kaydet()
# ---- oturmuş (IK ayak + IK el) ----
SEAT_Z=-0.16+TAB
def oturmus_poz(nefes=0):
    sifirla(); dinlenme_eli(20)
    konum("hips",yukari=-0.464); k("hips",x=-4)
    k("spine",x=-2); k("chest",x=4-1.2*nefes); k("upperChest",x=3-1.0*nefes); k("neck",x=-2); k("head",x=-2)
    kk("Shoulder",z=-2); kk("UpperLeg",x=83); kk("LowerLeg",x=-85)
    vl.update()
    for s in ("left","right"):
        sg=1 if s=="left" else -1
        kn=arm.bones[s+"LowerLeg"].head_local
        ayak_ctrl(s,(sg*0.15,-0.40,SEAT_Z),4,7)
    el_ik(False); kaydet()
    for s in ("left","right"):
        sg=1 if s=="left" else -1
        h=pb[s+"UpperLeg"].head; kn=pb[s+"UpperLeg"].tail
        ax=(kn-h).normalized()
        w=h+(kn-h)*0.58+Vector((0.035*sg,0,0.105))
        el_ctrl(s,w,ax+Vector((-0.12*sg,0,-0.35)),(0,0,-1))
    el_ik(True)
oturmus_poz(); K_OTUR=kaydet()
B_AYAK=yerel(K_AYAK); B_OTUR=yerel(K_OTUR)
SEAT_BILEK={s:pb[s+"Foot"].head.copy() for s in ("left","right")}
D=ayakta_bilek("left").y-SEAT_BILEK["left"].y
KL={}
# ---- BOSTA ----
KAY=[]
for f in range(0,121):
    t=f/120*2*math.pi
    ayakta_poz(math.sin(t),math.sin(t+1.0))
    k("head",y=2.0*math.sin(t+2.0),x=1.0*math.sin(t+0.5))
    KAY.append(kaydet())
KL["bosta"]=KAY
# ---- OTURUYOR ----
KAY=[]
for f in range(0,121):
    t=f/120*2*math.pi
    oturmus_poz(math.sin(t)); k("head",x=-2,y=3*math.sin(t+1))
    KAY.append(kaydet())
KL["oturuyor"]=KAY
# ---- OTUR (0.8 s) / KALK (0.7 s) ----
def gecis(tur,N):
    KAY=[]
    for f in range(0,N+1):
        u=f/N
        sifirla(); el_ik(False)
        if tur=="otur":
            a=u; s1=sm(u/0.75); s2=sm((u-0.15)/0.85); lean=30*math.sin(math.pi*min(1,u/0.95))
            ileri=-D*(s1-u); yuk=-0.304*s2-0.16*u; b_=sm(u)
        else:
            a=1-u; s1=sm(u/0.8); s2=sm((u-0.25)/0.75); lean=32*math.sin(math.pi*min(1,u/0.9))
            ileri=D*(s1-u); yuk=-0.304*(1-s2)-0.16*(1-u); b_=1-sm(u)
        # b_: 0=ayakta 1=oturmuş karışım
        konum("hips",yukari=yuk-0.014*(1-b_),ileri=ileri)
        k("hips",x=-4*b_+lean*0.55); k("spine",x=-2*b_+lean*0.30); k("chest",x=4*b_+lean*0.15); k("upperChest",x=3*b_)
        k("neck",x=-2*b_-lean*0.25); k("head",x=-2*b_-lean*0.15)
        kk("UpperLeg",x=83*b_+10); kk("LowerLeg",x=-85*b_-10)
        for s in ("left","right"):
            A=ayakta_bilek(s); Sb=SEAT_BILEK[s]
            p=A+(Sb-A)*a  # kök doğrusal hareket ediyor -> ayak kök uzayında doğrusal
            ayak_ctrl(s,p,4*a,7)
        kol_uygula(B_AYAK,B_OTUR,b_)
        # parmakları da karıştır (kol_uygula KOL içinde parmaklar var)
        KAY.append(kaydet())
    return KAY
KL["otur"]=gecis("otur",OTUR_KARE)
KL["kalk"]=gecis("kalk",KALK_KARE)
for ad,K in KL.items():
    bake(ad,K,dongu=ad in ("bosta","oturuyor"))
ik_sil()
rig.animation_data.action=bpy.data.actions["bosta"]
result={"D":round(D,3),"seat_bilek":[round(v,3) for v in SEAT_BILEK["left"]],"aksiyon":{a.name:a.frame_range[:] for a in bpy.data.actions}}
