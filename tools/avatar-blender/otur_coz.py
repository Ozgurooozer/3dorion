exec(open(BETIK+"/anim_ortak.py").read())
sifirla()
HEDEF_KALCA=0.30; HEDEF_AYAK=-0.16
kk("UpperLeg",x=88,z=-4); kk("LowerLeg",x=-88); kk("Foot",x=0)
k("spine",x=-4); k("chest",x=2)
bpy.context.view_layer.update()
kz,az,_=olc()
# kalça konumu ile oturt, sonra diz/ayak bileği ile ayağı yere indir
konum("hips",yukari=HEDEF_KALCA-kz); bpy.context.view_layer.update()
iz=[]
kalca_ac=88.0
for it in range(15):
    kk("UpperLeg",x=kalca_ac,z=-4); kk("LowerLeg",x=-kalca_ac-2); kk("Foot",x=4)
    konum("hips",yukari=0); bpy.context.view_layer.update()
    kz,az,_=olc(); konum("hips",yukari=HEDEF_KALCA-kz); bpy.context.view_layer.update()
    kz,az,_=olc(); iz.append((round(kalca_ac,1),round(kz,3),round(az,3)))
    d=az-HEDEF_AYAK
    if abs(d)<0.002: break
    kalca_ac-= d*250   # ayak yüksekse (d>0) kalça fleksiyonunu azalt -> diz iner
kz,az,_=olc()
OTUR={"hips_yukari":pb["hips"].location[1],"diz":math.degrees(pb["leftLowerLeg"].rotation_euler.x),"ayak":math.degrees(pb["leftFoot"].rotation_euler.x)}
# görsel kontrol: zemin + sandalye kutusu
for n in ("_zemin","_sandalye"):
    o=bpy.data.objects.get(n)
    if o: bpy.data.objects.remove(o,do_unlink=True)
import bmesh
def kutu(ad,boyut,yer):
    me=bpy.data.meshes.new(ad); bm=bmesh.new(); bmesh.ops.create_cube(bm,size=1); bm.to_mesh(me); bm.free()
    o=bpy.data.objects.new(ad,me); bpy.context.scene.collection.objects.link(o); o.scale=boyut; o.location=yer; return o
kutu("_zemin",(2,2,0.01),(0,0,-0.165)); kutu("_sandalye",(0.52,0.52,0.06),(0,0.04+0.0,0.27))
render("s_otur_yan",90,yuk=0.5,olcek=1.8); render("s_otur_capraz",35,yuk=0.5,olcek=1.8)
result={"iz":iz,"son":(round(kz,3),round(az,3)),"OTUR":OTUR}
