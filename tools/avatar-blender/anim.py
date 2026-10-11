exec(open(BETIK+"/anim_ortak.py").read())
sc.render.fps=30
for n in ("_zemin","_sandalye"):
    o=bpy.data.objects.get(n)
    if o: bpy.data.objects.remove(o,do_unlink=True)
rig.animation_data_create()
PARMAK=("Index","Middle","Ring","Little")
def dinlenme_eli(kivrim=14):
    for side in ("left","right"):
        for i,f in enumerate(PARMAK):
            k(side+f+"Proximal",x=kivrim+i*3); k(side+f+"Intermediate",x=kivrim+6+i*3); k(side+f+"Distal",x=kivrim)
        k(side+"ThumbProximal",x=8); k(side+"ThumbIntermediate",x=10); k(side+"ThumbDistal",x=10)
def anahtar(f):
    for b in pb:
        b.keyframe_insert("rotation_euler",frame=f,group=b.name)
    pb["hips"].keyframe_insert("location",frame=f,group="hips")
def yeni_aksiyon(ad):
    a=bpy.data.actions.get(ad)
    if a: bpy.data.actions.remove(a)
    a=bpy.data.actions.new(ad); a.use_fake_user=True
    rig.animation_data.action=a
    return a
def dongusel(a):
    for fc in _fcurves(a):
        m=fc.modifiers.new('CYCLES')
def _fcurves(a):
    try:
        return list(a.fcurves)
    except AttributeError:
        out=[]
        for l in a.layers:
            for s in l.strips:
                for cb in s.channelbags: out+=list(cb.fcurves)
        return out
# ---------- ayakta taban poz ----------
def ayakta(kol_z=-15, dirsek=10):
    sifirla(); dinlenme_eli()
    for _s,_g in (("left",1),("right",-1)): dunya_don(_s+"UpperArm",[((0,-1,0),kol_z*_g)])
    kk("LowerArm",x=dirsek); kk("Hand",x=0)
    kk("Shoulder",z=-3)
# ---------- BOSTA ----------
yeni_aksiyon("bosta")
N=120
for f in range(0,N+1,10):
    t=f/N*2*math.pi
    ayakta()
    nefes=math.sin(t); ag=math.sin(t/2+0.3) if False else math.sin(t)  # 1 nefes / 4 sn
    k("chest",x=-1.2*nefes); k("upperChest",x=-1.0*nefes); kk("Shoulder",z=-3+1.2*nefes)
    sal=math.sin(t+1.0)
    konum("hips",yan=0.008*sal, yukari=-0.003*(1+nefes)/2); k("hips",z=1.2*sal); k("spine",z=-0.8*sal); k("chest",z=-0.4*sal)
    k("head",y=2.5*math.sin(t*0.5+0.7) if False else 2.0*math.sin(t+2.0), x=1.0*math.sin(t+0.5))
    for _s,_g in (("left",1),("right",-1)): dunya_don(_s+"UpperArm",[((0,-1,0),-15*_g),((1,0,0),-1.0*nefes)])
    anahtar(f)
dongusel(bpy.data.actions["bosta"])
# ---------- OTUR / OTURUYOR / KALK ----------
OT=dict(hips=-0.464,kalca=82.8,diz=-84.8,ayak=4)
def oturmus(nefes=0):
    sifirla(); dinlenme_eli(18)
    konum("hips",yukari=OT["hips"]); k("hips",x=-4)
    kk("UpperLeg",x=OT["kalca"],z=-4); kk("LowerLeg",x=OT["diz"]); kk("Foot",x=OT["ayak"])
    k("spine",x=-2); k("chest",x=4-1.2*nefes); k("upperChest",x=3-1.0*nefes); k("neck",x=-2); k("head",x=-2)
    kk("UpperArm",x=28,z=-14); kk("LowerArm",x=48); kk("Hand",x=-8)
def karistir(poz_a,poz_b,u):
    """iki pozu (dict ad->(rot,loc)) karıştır ve uygula"""
    for b in pb:
        ra,la=poz_a[b.name]; rb,lb=poz_b[b.name]
        b.rotation_euler=[ra[i]+(rb[i]-ra[i])*u for i in range(3)]
        b.location=[la[i]+(lb[i]-la[i])*u for i in range(3)]
def yakala():
    return {b.name:(tuple(b.rotation_euler),tuple(b.location)) for b in pb}
ayakta(); P_AYAK=yakala()
oturmus(); P_OTUR=yakala()
# ara poz: öne eğilmiş, kalça yarı inmiş
sifirla(); dinlenme_eli(16)
konum("hips",yukari=-0.30, ileri=0.0); k("hips",x=22)
kk("UpperLeg",x=62,z=-4); kk("LowerLeg",x=-78); kk("Foot",x=-6)
k("spine",x=12); k("chest",x=8); k("neck",x=-10); k("head",x=-8)
kk("UpperArm",x=30,z=-12); kk("LowerArm",x=35)
P_ARA=yakala()
def gecis(ad,a,b,c,N=42):
    yeni_aksiyon(ad)
    for f in range(0,N+1,3):
        u=f/N
        if u<0.55: v=u/0.55; v=v*v*(3-2*v); karistir(a,b,v)
        else: v=(u-0.55)/0.45; v=v*v*(3-2*v); karistir(b,c,v)
        anahtar(f)
gecis("otur",P_AYAK,P_ARA,P_OTUR)
gecis("kalk",P_OTUR,P_ARA,P_AYAK)
yeni_aksiyon("oturuyor")
for f in range(0,121,10):
    oturmus(math.sin(f/120*2*math.pi)); k("head",x=-2,y=3*math.sin(f/120*2*math.pi+1)); anahtar(f)
dongusel(bpy.data.actions["oturuyor"])
rig.animation_data.action=bpy.data.actions["bosta"]
result={a.name:(a.frame_range[:],a.use_fake_user) for a in bpy.data.actions}
