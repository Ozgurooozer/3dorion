import numpy as np
from mathutils import Vector
W=np.array((0.388,-0.065,0.915)); d=np.array((0.271,-0.26,-0.927)); d/=np.linalg.norm(d)
t=(V-W)@d
def bilesenler(mask):
    ids=np.nonzero(mask)[0]; S=set(ids.tolist())
    adj={i:[] for i in ids}
    em=mask[E[:,0]]&mask[E[:,1]]
    for a,b in E[em]: adj[a].append(b); adj[b].append(a)
    seen=set(); comps=[]
    for s in ids:
        if s in seen: continue
        st=[s]; seen.add(s); c=[]
        while st:
            x=st.pop(); c.append(x)
            for y in adj[x]:
                if y not in seen: seen.add(y); st.append(y)
        comps.append(np.array(c))
    return comps
def merkez_hatti(P,taban):
    # taban'dan uzaklığa göre dilimle, her dilim ortalaması
    ax=P.mean(0)-taban; 
    u,s,vt=np.linalg.svd(P-P.mean(0)); a=vt[0]
    if a@ax<0: a=-a
    s_=(P-taban)@a; smax=s_.max()
    pts=[]
    for k in np.linspace(0,smax,9):
        m=np.abs(s_-k)<max(0.004,smax/18)
        if m.sum()>3: pts.append(P[m].mean(0))
    uc=P[np.argmax(s_)]
    return a,pts,uc,smax
sonuc={}
yan=(V[:,0]>0.33)&(V[:,2]<0.95)&(V[:,2]>0.7)
# 4 parmak: knuckle-ağ düzleminin ötesi
comps=bilesenler(yan&(t>0.115))
comps=[c for c in comps if len(c)>30]
parm=[]
for c in comps:
    P=V[c]
    ks=kesit(tuple(W+d*0.115),tuple(d),lambda q:np.linalg.norm(np.array(q)-P.mean(0))<0.06)
    taban=np.array(min(ks,key=lambda k:np.linalg.norm(np.array(k[0])-P.mean(0)))[0]) if ks else P[np.argmin((P-W)@d)]
    a,pts,uc,L=merkez_hatti(P,taban)
    parm.append({"n":len(c),"y":float(P[:,1].mean()),"taban":taban.round(4).tolist(),"uc":uc.round(4).tolist(),"eksen":a.round(3).tolist(),"L":round(float(L),4),"hat":[p.round(4).tolist() for p in pts]})
parm.sort(key=lambda p:p["y"])  # en ön (y en küçük)=işaret
sonuc["parmaklar"]=parm
# başparmak
bm_=yan&(t>0.04)&(t<0.13)&(V[:,1]<-0.125)&(V[:,0]<0.405)
tc=bilesenler(bm_); tc=sorted(tc,key=len)[-1]; P=V[tc]
sonuc["bas"]={"n":len(tc),"bb":[P.min(0).round(3).tolist(),P.max(0).round(3).tolist()],"uc_eny":P[np.argmin(P[:,1])].round(4).tolist(),"uc_altz":P[np.argmin(P[:,2])].round(4).tolist()}
