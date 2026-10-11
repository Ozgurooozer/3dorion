exec(open(BETIK+"/pozlar.py").read())
import numpy as np
def k(ad,x=0,y=0,z=0):
    b=pb[ad]; s=-1 if ad.startswith("right") else 1
    b.rotation_mode='XYZ'; b.rotation_euler=(R(x),R(y)*s,R(z)*s)
def kk(ad,x=0,y=0,z=0,**kw):  # iki yana aynı (aynalı)
    for side in ("left","right"): k(side+ad,x,y,z)
def konum(ad,yukari=0,ileri=0,yan=0):
    pb[ad].location=(yan,yukari,ileri)
govde=bpy.data.objects["orion_govde"]
_rest=np.array([v.co[:] for v in govde.data.vertices])
def olc():
    dg=bpy.context.evaluated_depsgraph_get(); ev=govde.evaluated_get(dg); me=ev.to_mesh()
    P=np.array([(govde.matrix_world@v.co)[:] for v in me.vertices]); ev.to_mesh_clear()
    kalca=(np.abs(_rest[:,0])<0.16)&(_rest[:,2]>0.78)&(_rest[:,2]<1.0)&(_rest[:,1]>0.0)
    ayak=_rest[:,2]<0.1
    return float(P[kalca][:,2].min()), float(P[ayak][:,2].min()), P

def dunya_don(ad,donusler):
    """Dinlenme (armatür) eksenlerinde sıralı dönüşler -> kemiğin yerel quaternion'u.
    (eksen, derece) listesi; ilk eleman ilk uygulanır."""
    from mathutils import Quaternion, Vector
    b=pb[ad]; R3=b.bone.matrix_local.to_3x3(); Ri=R3.inverted()
    q=Quaternion()
    for ax,deg in donusler:
        q=Quaternion((Ri@Vector(ax)).normalized(),R(deg))@q
    b.rotation_mode='XYZ'; b.rotation_euler=q.to_euler('XYZ')
