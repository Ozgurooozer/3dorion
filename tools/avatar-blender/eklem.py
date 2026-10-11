# kesit_yardim.py + parmak.py'den sonra exec edilir. Sol taraf eklemlerini ölçer.
import numpy as np, mathutils
from mathutils import Vector
from mathutils.bvhtree import BVHTree
# BVH (lv1 mesh) içerde-mi testi
_src=bpy.data.objects["GEO-body_male_realistic"]; _m=_src.modifiers[0]; _e=_m.levels; _m.levels=1
_dg=bpy.context.evaluated_depsgraph_get(); _me=bpy.data.meshes.new_from_object(_src.evaluated_get(_dg)); _m.levels=_e
_me.transform(_src.matrix_world)
BVH=BVHTree.FromPolygons([v.co.copy() for v in _me.vertices],[tuple(p.vertices) for p in _me.polygons])
bpy.data.meshes.remove(_me)
def derinlik(p):
    loc,no,i,dist=BVH.find_nearest(Vector(p))
    return dist if (Vector(p)-loc).dot(no)<0 else -dist
def dilim_y(z,xmax=0.09):
    m=V[(np.abs(V[:,2]-z)<0.006)&(np.abs(V[:,0])<xmax)]
    return float(m[:,1].min()),float(m[:,1].max())
def ortala(p,yon,yaricap=0.07):
    """p'den geçen, yon'a dik kesitte p'ye en yakın halkanın merkezi."""
    ks=kesit(tuple(p),tuple(yon),lambda c:np.linalg.norm(np.array(c)-np.array(p))<yaricap)
    if not ks: return np.array(p)
    return np.array(min(ks,key=lambda k:(np.array(k[0])-np.array(p)).__pow__(2).sum())[0])
J={}
H=float(V[:,2].max())
# --- omurga: gövde ön-arka aralığında sırtın 1/3'ü
for ad,z in (("hips",0.95),("spine",1.06),("chest",1.20),("upperChest",1.33),("neck",1.465),("head",1.575)):
    ymin,ymax=dilim_y(z, 0.09 if z<1.45 else 0.06)
    oran=0.55 if ad in("hips",) else (0.62 if ad in ("spine","chest","upperChest") else 0.55)
    J[ad]=np.array((0.0, ymin+oran*(ymax-ymin), z))
_nk=kesit((0,0,1.50),(0,0,1),lambda c:abs(c[0])<0.05); _ny=float(max(_nk,key=lambda k:k[2])[0][1])
J["head"]=np.array((0.0,_ny+0.005,1.575)); J["neck"][1]=0.5*(J["neck"][1]+_ny)
J["headTop"]=np.array((0.0, J["head"][1], H))
# --- bacak
kalca=[]
for z in (0.76,0.72,0.68,0.64,0.60):
    ks=kesit((0,0,z),(0,0,1),lambda c:0.02<c[0]<0.3); kalca.append(np.array(max(ks,key=lambda k:k[2])[0]))
kalca=np.array(kalca); a=np.polyfit(kalca[:,2],kalca[:,0],1); b=np.polyfit(kalca[:,2],kalca[:,1],1)
zh=0.915
J["leftUpperLeg"]=np.array((np.polyval(a,zh)-0.012, np.polyval(b,zh), zh))   # femur başı uyluk ekseninin biraz içinde
J["leftLowerLeg"]=ortala((0.136,0.006,0.497),(0,0,1))
J["leftFoot"]=ortala((0.178,0.05,0.085),(0,0,1))
ayak=V[(V[:,2]<0.07)&(V[:,0]>0.05)]
ucy=float(ayak[:,1].min()); topuky=float(ayak[:,1].max())
uc=ayak[np.argmin(ayak[:,1])]
top=np.array((J["leftFoot"][0], topuky, 0.0))
L=topuky-ucy
toe_y=topuky-0.73*L
ts=ayak[np.abs(ayak[:,1]-toe_y)<0.008]
_tz=V[(np.abs(V[:,1]-toe_y)<0.008)&(V[:,0]>0.05)&(V[:,0]<0.35)&(V[:,2]<0.12)]
J["leftToes"]=np.array((0.5*float(_tz[:,0].min()+_tz[:,0].max()), toe_y, 0.5*float(_tz[:,2].min()+_tz[:,2].max())))
J["leftToeTip"]=np.array((float(uc[0]), ucy, 0.02))
J["leftHeel"]=top
# --- kol
J["leftShoulder"]=np.array((0.028, J["upperChest"][1]-0.03, 1.425))
J["leftUpperArm"]=np.array((0.172,0.02,1.398))
J["leftLowerArm"]=ortala((0.2985,0.0005,1.14),(0.466,-0.087,-0.882))
J["leftHand"]=np.array((0.388,-0.065,0.915))
# --- parmaklar
W=np.array((0.388,-0.065,0.915)); dd=np.array((0.271,-0.26,-0.927)); dd/=np.linalg.norm(dd); tt=(V-W)@dd
yan=(V[:,0]>0.33)&(V[:,2]<0.95)&(V[:,2]>0.7)
cs=sorted([c for c in bilesenler(yan&(tt>0.12)) if len(c)>15],key=lambda c:V[c][:,1].mean())
adlar=["Index","Middle","Ring","Little"]
for ad,c in zip(adlar,cs):
    P=V[c]
    web=np.array(min(kesit(tuple(W+dd*0.12),tuple(dd),lambda q:np.linalg.norm(np.array(q)-P.mean(0))<0.05),key=lambda k:np.linalg.norm(np.array(k[0])-P.mean(0)))[0])
    # parmak ucu: web'den en uzak nokta
    uzak=P[np.argmax(np.linalg.norm(P-web,axis=1))]
    ax=(uzak-web)/np.linalg.norm(uzak-web)
    geri=0.018 if ad=="Little" else 0.022
    mcp=web-ax*geri
    Lf=np.linalg.norm(uzak-mcp)
    # eğri orta hat: mcp->uç arasında dilimlerle
    pts=[]
    for f in (0.47,0.75):
        q=mcp+(uzak-mcp)*f
        pts.append(ortala(q,ax,0.02))
    J["left"+ad+"Proximal"]=mcp; J["left"+ad+"Intermediate"]=pts[0]; J["left"+ad+"Distal"]=pts[1]; J["left"+ad+"Tip"]=uzak-ax*0.004
# başparmak
bm_=yan&(tt>0.04)&(tt<0.13)&(V[:,1]<-0.125)&(V[:,0]<0.405)
tc=sorted(bilesenler(bm_),key=len)[-1]; P=V[tc]
tuc=P[np.argmin(P[:,1])]
cmc=np.array((0.392,-0.085,0.888))
tax=(tuc-cmc)/np.linalg.norm(tuc-cmc)
J["leftThumbProximal"]=ortala(cmc,tax,0.04)
J["leftThumbIntermediate"]=ortala(cmc+(tuc-cmc)*0.42,tax,0.03)
J["leftThumbDistal"]=ortala(cmc+(tuc-cmc)*0.74,tax,0.02)
J["leftThumbTip"]=tuc-tax*0.004
RAPOR={k:(np.round(v,4).tolist(), round(derinlik(v)*1000,1)) for k,v in J.items()}
