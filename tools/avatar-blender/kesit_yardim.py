# Blender içinde exec edilir. Base mesh'i (multires lv1) numpy dizilerine alır,
# kesit(co, no) -> [(merkez, ort_yaricap, nokta_sayisi), ...] (bağlı halka başına)
import bpy, numpy as np
from mathutils import Vector
def _hazirla():
    src=bpy.data.objects["GEO-body_male_realistic"]; m=src.modifiers[0]; eski=m.levels; m.levels=1
    dg=bpy.context.evaluated_depsgraph_get(); me=bpy.data.meshes.new_from_object(src.evaluated_get(dg)); m.levels=eski
    me.transform(src.matrix_world)
    V=np.empty(len(me.vertices)*3); me.vertices.foreach_get("co",V); V=V.reshape(-1,3)
    E=np.empty(len(me.edges)*2,dtype=np.int64); me.edges.foreach_get("vertices",E); E=E.reshape(-1,2)
    # yüz -> kenar indeksleri
    LE=np.empty(len(me.loops),dtype=np.int64); me.loops.foreach_get("edge_index",LE)
    LS=np.empty(len(me.polygons),dtype=np.int64); me.polygons.foreach_get("loop_start",LS)
    LT=np.empty(len(me.polygons),dtype=np.int64); me.polygons.foreach_get("loop_total",LT)
    bpy.data.meshes.remove(me)
    return V,E,LE,LS,LT
V,E,LE,LS,LT=_hazirla()
def kesit(co,no,filtre=None):
    co=np.array(co,float); no=np.array(no,float); no/=np.linalg.norm(no)
    d=(V-co)@no
    a=d[E[:,0]]; b=d[E[:,1]]
    cr=(a*b)<0
    idx=np.nonzero(cr)[0]
    if len(idx)==0: return []
    t=a[idx]/(a[idx]-b[idx])
    P=V[E[idx,0]]+(V[E[idx,1]]-V[E[idx,0]])*t[:,None]
    pos={int(e):i for i,e in enumerate(idx)}
    par=list(range(len(idx)))
    def bul(x):
        while par[x]!=x: par[x]=par[par[x]]; x=par[x]
        return x
    crl=cr[LE]
    for s,n in zip(LS,LT):
        c=LE[s:s+n][crl[s:s+n]]
        if len(c)>=2:
            r0=bul(pos[int(c[0])])
            for e in c[1:]:
                r=bul(pos[int(e)]);
                if r!=r0: par[r]=r0
    gr={}
    for i in range(len(idx)): gr.setdefault(bul(i),[]).append(i)
    out=[]
    for g in gr.values():
        Q=P[g]; c=Q.mean(0); r=np.linalg.norm(Q-c,axis=1).mean()
        if filtre is None or filtre(c): out.append((Vector(c),float(r),len(g)))
    return out
