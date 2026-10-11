# Analitik iki-kemik IK (kosinüs yasası). Blender IK kısıtı YOK -> deterministik.
from mathutils import Matrix, Vector, Quaternion
arm=rig.data; vl=bpy.context.view_layer
DEF=[b.name for b in arm.bones if b.use_deform]
HEDEF={}      # ("ayak"|"el", s) -> (konum Vector, rot Matrix3 (armatür), pole Vector|None)
EL_IK=[False]
def el_ik(e): EL_IK[0]=e
def ik_kur(): HEDEF.clear(); return {}
def ik_sil(): HEDEF.clear()
def _dunya_rot(ad, rest_rot_hedef):
    return rest_rot_hedef
def ayak_ctrl(s,konum,pitch=0,yaw=0):
    rest=arm.bones[s+"Foot"].matrix_local; sg=1 if s=="left" else -1
    Rt=(Matrix.Rotation(R(yaw*sg),3,'Z')@Matrix.Rotation(R(-pitch),3,'X'))@rest.to_3x3()
    HEDEF[("ayak",s)]=(Vector(konum),Rt)
def el_ctrl(s,konum,Y,Z):
    Y=Vector(Y).normalized(); Z=Vector(Z); Z=(Z-Y*Z.dot(Y)).normalized(); X=Y.cross(Z)
    HEDEF[("el",s)]=(Vector(konum),Matrix((X,Y,Z)).transposed())
def _mat(X,Y,Z,t):
    M=Matrix((X,Y,Z)).transposed().to_4x4(); M.translation=t; return M
def _zincir(ust,alt,uc,t,rot,pole):
    vl.update()
    bu=arm.bones[ust]; bl=arm.bones[alt]; a=bu.length; b=bl.length
    h=pb[ust].head.copy(); v=t-h; dist=v.length; e=v.normalized()
    d=min(dist,(a+b)*0.9995); d=max(d,abs(a-b)+1e-4)
    x=(a*a-b*b+d*d)/(2*d); r=math.sqrt(max(0,a*a-x*x))
    p=(pole-h); p=(p-e*p.dot(e)).normalized()
    kn=h+e*x+p*r; an=h+e*d
    Yu=(kn-h).normalized(); Yl=(an-kn).normalized()
    n=Yu.cross(Yl)
    Xr=pb[ust].matrix.to_3x3().col[0]   # mevcut (ebeveyne göre dinlenme) X ekseni
    if n.length<1e-6: n=Xr-Yu*Xr.dot(Yu)
    n.normalize()
    if n.dot(bu.matrix_local.to_3x3().col[0] if False else Xr)<0: n=-n
    Xu=(n-Yu*n.dot(Yu)).normalized(); Zu=Xu.cross(Yu)
    pb[ust].matrix=_mat(Xu,Yu,Zu,h); vl.update()
    Xl=(n-Yl*n.dot(Yl)).normalized(); Zl=Xl.cross(Yl)
    pb[alt].matrix=_mat(Xl,Yl,Zl,kn); vl.update()
    M=rot.to_4x4(); M.translation=an; pb[uc].matrix=M; vl.update()
def kaydet():
    vl.update()
    for s in ("left","right"):
        sg=1 if s=="left" else -1
        if ("ayak",s) in HEDEF:
            t,rot=HEDEF[("ayak",s)]
            h=pb[s+"UpperLeg"].head
            pole=h+Vector((0.05*sg,-1.0,0.35))
            _zincir(s+"UpperLeg",s+"LowerLeg",s+"Foot",t,rot,pole)
        if EL_IK[0] and ("el",s) in HEDEF:
            t,rot=HEDEF[("el",s)]
            h=pb[s+"UpperArm"].head
            pole=h+Vector((0.35*sg,0.8,-0.4))
            _zincir(s+"UpperArm",s+"LowerArm",s+"Hand",t,rot,pole)
    return {n:pb[n].matrix.copy() for n in DEF}
