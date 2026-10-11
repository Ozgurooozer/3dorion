# `yuru` klibi: ayak yörüngeleri (topuk→düz→parmak ucu, salınım kavisi) +
# bacağın ulaşabildiği en yüksek pürüzsüz pelvis; bacaklar ANALİTİK IK ile.
# (2026-09-27: Blender IK kısıtı dizi geriye kırıyordu — diz_olc.py ile ölçüldü.)
# anim.py önsözü + bake.py + ik_analitik.py'den sonra exec edilir.
from mathutils import Matrix, Vector, Quaternion
arm=rig.data; vl=bpy.context.view_layer
N=35; T=N/30.0; V_HIZ=1.25; DONGU=V_HIZ*T; BETA=0.58; D=DONGU*BETA
# Topuk kalkışı: başlangıç fazı ve itişteki taban açısı. Arkadaki bacağı
# uzatır; geç/az kalkarsa çift destekte pelvis çöker, öndeki diz 30°+ bükülür.
TOPUK=0.35; ITIS=55.0
def sm(u): u=min(1,max(0,u)); return u*u*(3-2*u)
def mj(u): u=min(1,max(0,u)); return u**3*(10-15*u+6*u*u)
def Rx(deg,piv):
    piv=Vector(piv); return Matrix.Translation(piv)@Matrix.Rotation(R(-deg),4,'X')@Matrix.Translation(-piv)
# Ayak hedefinin dinlenme matrisi = Foot kemiğininki (bilek başta, taban düz).
REST={s:arm.bones[s+"Foot"].matrix_local.copy() for s in ("left","right")}
def geo(s):
    A=arm.bones[s+"Foot"].head_local.copy(); tb=arm.bones[s+"Toes"].head_local.copy()
    return A, Vector((A.x,0.108,0.0)), Vector((tb.x,tb.y,0.0))
H0=-0.292; DY0=H0-0.108
def stance_M(s,q):
    A,heel,ball=geo(s); dy=DY0+q*DONGU
    if q<0.1: M=Rx(15*(1-sm(q/0.1)),heel); p=15*(1-sm(q/0.1))
    elif q<TOPUK: M=Matrix.Identity(4); p=0
    else: p=-ITIS*sm((q-TOPUK)/(BETA-TOPUK)); M=Rx(p,ball)
    return Matrix.Translation((0,dy,0))@M, p
IZ_X=0.100; ACI_DIS=6.0
def ayak_M(s,q):
    M,toe=_ayak_M(s,q)
    A,_,_=geo(s); sg=1 if s=="left" else -1
    Rz=Matrix.Translation(A)@Matrix.Rotation(R(ACI_DIS*sg),4,'Z')@Matrix.Translation(-A)
    return Matrix.Translation((sg*IZ_X-A.x,0,0))@M@REST[s].inverted()@Rz@REST[s], toe
def _ayak_M(s,q):
    q%=1.0
    if q<BETA:
        M,p=stance_M(s,q); toe=max(0,-p)
        return M@REST[s], toe
    u=(q-BETA)/(1-BETA)
    A,_,_=geo(s)
    Ms,ps=stance_M(s,BETA-1e-6); Me,pe=stance_M(s,0.0)
    As=Ms@A; Ae=Me@A
    y=As.y+(Ae.y-As.y)*mj(u)
    z=As.z+(Ae.z-As.z)*u+0.075*math.sin(math.pi*min(1,u*1.15))**1.3
    x=As.x
    p=-ITIS*(1-sm(u/0.45)) if u<0.45 else 15*sm((u-0.45)/0.55)
    M=Matrix.Translation(Vector((x,y,z))-A)@Rx(p,A)
    toe=ITIS*(1-sm(u/0.3))
    return M@REST[s], toe
# pelvis yüksekliği: bacak boyu sınırı
HIP={s:arm.bones[s+"UpperLeg"].head_local.copy() for s in ("left","right")}
# Erişim payı: kosinüs yasasında %99 bile ~16° ZORUNLU diz bükümü demek
# (bacak hiç düzleşmez, çömelik yürür — canlıda görüldü). %99.7 ≈ 9°.
LB={s:(arm.bones[s+"UpperLeg"].length+arm.bones[s+"LowerLeg"].length)*0.997 for s in ("left","right")}
FAZ={"left":0.0,"right":0.5}
ham=[]
for f in range(N):
    p=f/N; lim=9
    for s in ("left","right"):
        if ((p+FAZ[s])%1.0)>=BETA: continue
        M,_=ayak_M(s,p+FAZ[s]); A=M.translation
        yan=0.018*math.cos(2*math.pi*(p-0.3))
        h=HIP[s]+Vector((yan,0,0)); dx=A.x-h.x; dy=A.y-h.y
        lim=min(lim, A.z+math.sqrt(max(0,LB[s]**2-dx*dx-dy*dy))-h.z)
    nom=-0.025+0.012*math.cos(4*math.pi*(p-0.3))
    ham.append((nom,lim))
# Pelvis: basan bacağın erişim sınırının ALTINDA, EĞİMİ sınırlı zarf.
# Her kare sınıra olabildiğince yakın (diz neredeyse düz), yalnızca kareden
# kareye iniş/çıkış hızı kısılır — bacak basmayı bıraktığında sınırın ani
# sıçraması pelviste sıçrama olmasın. Denendi ve bırakıldı: tek sinüs
# uydurması (en kötü kare bütün döngüyü aşağı iter) ve yumuşat+kırp
# tekrarı (sınırın minimumuna düzleşir, diz 30-43° bükük kalır — ölçüldü).
EGIM=0.012   # m/kare = 0.36 m/s dikey (0.006 basma ortasını 2 cm aşağı çekiyordu)
# Tavan dinlenme yüksekliği DEĞİL: dinlenme A-poz, ayaklar yana açık (bilek
# x=0.179); yürürken ayak kalçanın altında (x=0.10) ve bacak düşeyde ~1 cm
# daha uzun. -0.005 tavanı o 1 cm'yi kosinüs yasasında ~20° diz bükümüne
# çeviriyordu (ölçüldü). Güvenlik için +2 cm'de kesilir.
# Pay 0.5 mm: düze yakın dizde 5 mm pelvis düşüşü ≈ 16° büküm (ölçüldü).
_tavan=[min(ham[f][1]-0.0005, 0.02) for f in range(N)]
yuk=list(_tavan)
for _ in range(3):   # döngüsel: ileri + geri geçiş, birkaç tur
    for i in range(N): yuk[i]=min(yuk[i], yuk[i-1]+EGIM)
    for i in range(N-1,-1,-1): yuk[i]=min(yuk[i], yuk[(i+1)%N]+EGIM)
for _ in range(2):   # hafif yumuşatma, yine sınırın altında
    yuk=[min(_tavan[i],(yuk[i-1]+2*yuk[i]+yuk[(i+1)%N])/4) for i in range(N)]
# ---- kareleri kur ve bake için oku ----
DEF=[b.name for b in arm.bones if b.use_deform]
KAYIT=[]
for f in range(N+1):
    p=(f%N)/N; t=2*math.pi*p
    sifirla(); dinlenme_eli(14) if 'dinlenme_eli' in dir() else None
    for s in ("left","right"):
        M,toe=ayak_M(s,p+FAZ[s])
        if ((p+FAZ[s])%1.0)>=BETA:
            A=M.translation; yan=0.018*math.cos(2*math.pi*(p-0.3))
            h=HIP[s]+Vector((yan,0,yuk[f%N])); dx=A.x-h.x; dy=A.y-h.y
            zmin=h.z-math.sqrt(max(0,(LB[s]*0.99)**2-dx*dx-dy*dy))
            if A.z<zmin: M=Matrix.Translation((0,0,zmin-A.z))@M
        HEDEF[("ayak",s)]=(M.translation.copy(),M.to_3x3()); k(s+"Toes",x=toe)
    vl.update()
    konum("hips",yukari=yuk[f%N], yan=0.018*math.cos(2*math.pi*(p-0.3)))
    k("hips",x=2,y=-5*math.cos(t),z=3*math.cos(2*math.pi*(p-0.3)))
    k("spine",x=1,y=3*math.cos(t)); k("chest",x=0,y=3.5*math.cos(t)); k("upperChest",y=1*math.cos(t))
    k("neck",y=-1.5*math.cos(t)); k("head",x=-1,y=-1*math.cos(t))
    for s,sg in (("left",1),("right",-1)):
        sw=-16*math.cos(t-0.3)*sg
        k(s+"Shoulder",z=-3)
        dunya_don(s+"UpperArm",[((0,-1,0),-15*sg),((1,0,0),-sw)])
        k(s+"LowerArm",x=12+max(0,sw)*0.6); k(s+"Hand",x=3)
    vl.update()
    KAYIT.append(kaydet())   # ik_analitik: bacakları kosinüs yasasıyla çözer
