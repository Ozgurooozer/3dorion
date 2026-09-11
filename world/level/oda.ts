// world/level/oda.ts — Orion'un çalışma odasının mesh üretimi.
//
// Ölçüler burada DEĞİL, `olculer.ts` içinde. Bu dosya yalnızca "o sayıları
// Babylon mesh'ine çevir" işini yapar. molp `SceneManager._buildOffice`
// referans alındı; oradaki tek 170 satırlık gövde burada adlandırılmış
// bölümlere ayrıldı ve grid-birimi (`u()`) dolaylılığı kaldırıldı — metre.
//
// Performans (K2: 60 FPS, 8GB VRAM):
//   - Gölge YOK. Tek DirectionalLight + tek HemisphericLight.
//   - Statik mesh'lerin dünya matrisi ve malzemeleri donduruldu.
//   - Malzeme sayısı azdır ve paylaşılır — draw call düşük kalır.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { ODA, MASA, MONITOR, SANDALYE, TAHTA, PENCERE, KAPI } from "./olculer.ts";

/** Odanın kurulumundan dönen tutamaçlar. T3 monitör ekranını, T2 zemini ister. */
export interface OdaKurulumu {
  /** Üretilen tüm statik mesh'ler — sayım ve temizlik için. */
  meshler: Mesh[];
  /** Monitör ekran düzlemi. T3 buraya DynamicTexture bağlayacak (yer tutucu). */
  monitorEkran: Mesh;
  /** Beyaz tahta yüzeyi. T2/T4 `yaz` niyetinde buraya yazacak (yer tutucu). */
  tahtaYuzey: Mesh;
  /** Zemin — raycast ve yer hizası için. */
  zemin: Mesh;
  /** Oyuncunun ışın testinde yok sayması gereken mesh'ler (cam, backdrop). */
  seffaflar: Mesh[];
}

/** Odanın kaç mesh'ten oluştuğunu HUD'a basmak için son kurulum. */
let _sonKurulum: OdaKurulumu | null = null;
export function sonOdaKurulumu(): OdaKurulumu | null { return _sonKurulum; }

export function odaKur(sahne: Scene): OdaKurulumu {
  const meshler: Mesh[] = [];
  let sira = 0;
  const ad = (on: string) => `${on}_${sira++}`;

  // ── Malzemeler ──────────────────────────────────────────────────────────
  // Tek yardımcı: mat renklendirir ve dondurur. Donmuş malzeme her karede
  // uniform yeniden bağlamaz — statik dekor için bedava kazanç.
  const mat = (
    isim: string,
    r: number, g: number, b: number,
    parlakOran = 0.04,
  ): StandardMaterial => {
    const m = new StandardMaterial(isim, sahne);
    m.diffuseColor = new Color3(r, g, b);
    m.emissiveColor = new Color3(r * parlakOran, g * parlakOran, b * parlakOran);
    m.specularColor = new Color3(0.04, 0.04, 0.05);
    return m;
  };

  const isikli = (isim: string, r: number, g: number, b: number): StandardMaterial => {
    const m = new StandardMaterial(isim, sahne);
    m.diffuseColor = new Color3(0.04, 0.05, 0.08);
    m.emissiveColor = new Color3(r, g, b);
    m.specularColor = Color3.Black();
    return m;
  };

  const mZemin  = mat("m_zemin", 0.16, 0.17, 0.21, 0.10);
  const mDuvar  = mat("m_duvar", 0.30, 0.31, 0.36, 0.14);
  const mTavan  = mat("m_tavan", 0.22, 0.23, 0.27, 0.10);
  const mAhsap  = mat("m_ahsap", 0.26, 0.18, 0.12, 0.06);
  const mMetal  = mat("m_metal", 0.13, 0.14, 0.18, 0.06);
  const mKoyu   = mat("m_koyu",  0.05, 0.055, 0.07, 0.02);
  const mVurgu  = isikli("m_vurgu", 0.06, 0.40, 0.55);
  const mBeyaz  = mat("m_beyaz", 0.88, 0.89, 0.90, 0.22);

  // ── Yardımcı şekiller ───────────────────────────────────────────────────
  const kutu = (
    isim: string,
    g: number, yuk: number, d: number,
    x: number, y: number, z: number,
    m: StandardMaterial,
  ): Mesh => {
    const mesh = CreateBox(ad(isim), { width: g, height: yuk, depth: d }, sahne);
    mesh.position.set(x, y, z);
    mesh.material = m;
    meshler.push(mesh);
    return mesh;
  };

  const silindir = (
    isim: string, cap: number, yuk: number,
    x: number, y: number, z: number, m: StandardMaterial,
  ): Mesh => {
    const mesh = CreateCylinder(ad(isim), { diameter: cap, height: yuk, tessellation: 12 }, sahne);
    mesh.position.set(x, y, z);
    mesh.material = m;
    meshler.push(mesh);
    return mesh;
  };

  const doku = (isim: string, dosya: string): Texture => {
    const t = new Texture(dosya, sahne, true, false);
    t.name = isim;
    return t;
  };

  const G = ODA.genislik, D = ODA.derinlik, Y = ODA.yukseklik, K = ODA.duvarKalinlik;

  // ── [1] Zemin ───────────────────────────────────────────────────────────
  const zemin = CreateGround("zemin", { width: G, height: D, subdivisions: 1 }, sahne);
  zemin.material = mZemin;
  meshler.push(zemin);

  // Zemin şeridi: derinlik algısı için ince vurgu hattı (halı kenarı yerine).
  kutu("hali", 3.6, 0.012, 2.6, 0, 0.006, -1.6, mKoyu);

  // ── [2] Duvarlar + tavan ────────────────────────────────────────────────
  // Duvarlar odanın DIŞINA taşar (merkez ± (boy/2 + K/2)); iç yüz tam SINIR'da.
  kutu("duvar_sol",  K, Y, D, -G / 2 - K / 2, Y / 2, 0, mDuvar);
  kutu("duvar_sag",  K, Y, D,  G / 2 + K / 2, Y / 2, 0, mDuvar);
  kutu("duvar_on",   G + K * 2, Y, K, 0, Y / 2,  D / 2 + K / 2, mDuvar);
  // Arka duvar DÖRT parça: pencere boşluğu gerçekten delik olsun diye.
  // Tek parça bırakılsa manzara düzlemi duvarın içinde kalır ve görünmez.
  {
    const zArka = -D / 2 - K / 2;
    const pSol = PENCERE.x - PENCERE.genislik / 2;   // boşluğun sol kenarı
    const pSag = PENCERE.x + PENCERE.genislik / 2;
    const pAlt = PENCERE.y - PENCERE.yukseklik / 2;
    const pUst = PENCERE.y + PENCERE.yukseklik / 2;
    const solG = pSol - (-G / 2 - K);
    kutu("duvar_arka_sol", solG, Y, K, -G / 2 - K + solG / 2, Y / 2, zArka, mDuvar);
    const sagG = (G / 2 + K) - pSag;
    kutu("duvar_arka_sag", sagG, Y, K, pSag + sagG / 2, Y / 2, zArka, mDuvar);
    kutu("duvar_arka_alt", PENCERE.genislik, pAlt, K, PENCERE.x, pAlt / 2, zArka, mDuvar);
    kutu("duvar_arka_ust", PENCERE.genislik, Y - pUst, K, PENCERE.x, (Y + pUst) / 2, zArka, mDuvar);
  }
  kutu("tavan", G + K * 2, K, D + K * 2, 0, Y + K / 2, 0, mTavan);

  // Tavan–duvar birleşimine ince vurgu şeridi (odayı "kutu" olmaktan çıkarır).
  kutu("seritSol",  0.04, 0.03, D, -G / 2 + 0.02, Y - 0.06, 0, mVurgu);
  kutu("seritSag",  0.04, 0.03, D,  G / 2 - 0.02, Y - 0.06, 0, mVurgu);
  kutu("seritArka", G, 0.03, 0.04, 0, Y - 0.06, -D / 2 + 0.02, mVurgu);

  // ── [3] Pencere (arka duvar) ────────────────────────────────────────────
  const seffaflar: Mesh[] = [];
  {
    const pg = PENCERE.genislik, py = PENCERE.yukseklik;
    const cerceve = 0.08;
    // Çerçeve: dört ince kutu, duvarın iç yüzünde.
    kutu("pen_alt", pg + cerceve * 2, cerceve, 0.10, PENCERE.x, PENCERE.y - py / 2, PENCERE.z, mMetal);
    kutu("pen_ust", pg + cerceve * 2, cerceve, 0.10, PENCERE.x, PENCERE.y + py / 2, PENCERE.z, mMetal);
    kutu("pen_sol", cerceve, py, 0.10, PENCERE.x - pg / 2, PENCERE.y, PENCERE.z, mMetal);
    kutu("pen_sag", cerceve, py, 0.10, PENCERE.x + pg / 2, PENCERE.y, PENCERE.z, mMetal);
    // Orta dikme
    kutu("pen_dikme", 0.04, py, 0.08, PENCERE.x, PENCERE.y, PENCERE.z, mMetal);

    // Manzara: duvarın ARKASINDA duran ışıklı düzlem. Pencere boşluğundan
    // görünür. Gerçek gökyüzü yok — tek doku, gölge maliyeti 0.
    // Boşluktan biraz büyük: kenarları görünmesin.
    const manzara = CreatePlane("pen_manzara", { width: pg + 0.5, height: py + 0.5 }, sahne);
    manzara.position.set(PENCERE.x, PENCERE.y, -ODA.derinlik / 2 - ODA.duvarKalinlik - 0.02);
    const mManzara = new StandardMaterial("m_manzara", sahne);
    const dManzara = doku("d_manzara", "window-city.png");
    mManzara.diffuseTexture = dManzara;
    mManzara.emissiveTexture = dManzara;
    mManzara.emissiveColor = new Color3(0.7, 0.75, 0.9);
    mManzara.specularColor = Color3.Black();
    mManzara.backFaceCulling = false;
    manzara.rotation.y = Math.PI; // varsayılan düzlem normali -Z; +Z'ye (odaya) çevir
    manzara.material = mManzara;
    manzara.metadata = { capa: "pencere" };
    meshler.push(manzara);
    seffaflar.push(manzara);

    // Arka duvarda pencere boşluğu: duvarı tek parça bıraktık, manzarayı
    // önüne koyduk. Işın testinin manzaradan geçmesi gerekmez (duvar zaten
    // arkada) ama oyuncu ışını cama çarpmasın diye şeffaf listesine girdi.
  }

  // ── [4] Masa ────────────────────────────────────────────────────────────
  {
    const mg = MASA.genislik, md = MASA.derinlik, mu = MASA.ustYuzey;
    kutu("masa_ust", mg, MASA.kalinlik, md, MASA.x, mu - MASA.kalinlik / 2, MASA.z, mAhsap)
      .metadata = { capa: "masa" };
    const ayak = 0.07;
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        kutu("masa_ayak", ayak, mu - MASA.kalinlik, ayak,
          MASA.x + sx * (mg / 2 - 0.12), (mu - MASA.kalinlik) / 2, MASA.z + sz * (md / 2 - 0.10), mMetal);
      }
    }
    // Masa altı LED şeridi — ışık yerine emissive; 0 gölge maliyeti.
    kutu("masa_led", mg - 0.2, 0.015, 0.02, MASA.x, mu - MASA.kalinlik - 0.02, MASA.z + md / 2 - 0.04, mVurgu);
    // Klavye yer tutucu
    kutu("klavye", 0.44, 0.02, 0.15, MASA.x, mu + 0.01, MASA.z + 0.22, mKoyu);
  }

  // ── [5] Monitör — ekran YALNIZCA yer tutucu düzlem (içerik T3'ün işi) ───
  const monitorEkran = CreatePlane("monitor_ekran",
    { width: MONITOR.genislik, height: MONITOR.yukseklik }, sahne);
  {
    // Ekran +Z'ye (oyuncuya) bakar. CreatePlane varsayılanı -Z normali olduğu
    // için Y ekseninde 180° döndürülür.
    monitorEkran.position.set(MONITOR.x, MONITOR.y, MONITOR.z + 0.03);
    monitorEkran.rotation.y = Math.PI;
    const mEkran = new StandardMaterial("m_monitor", sahne);
    mEkran.diffuseColor = new Color3(0.02, 0.03, 0.05);
    mEkran.emissiveColor = new Color3(0.05, 0.10, 0.14);
    mEkran.specularColor = Color3.Black();
    mEkran.backFaceCulling = false;
    monitorEkran.material = mEkran;
    monitorEkran.metadata = { capa: "monitor", yerTutucu: true };
    meshler.push(monitorEkran);

    // Kasa + ayak
    kutu("monitor_kasa", MONITOR.genislik + 0.06, MONITOR.yukseklik + 0.06, 0.04,
      MONITOR.x, MONITOR.y, MONITOR.z, mKoyu);
    silindir("monitor_boyun", 0.05, 0.22, MONITOR.x, MASA.ustYuzey + 0.11, MONITOR.z, mMetal);
    kutu("monitor_taban", 0.34, 0.02, 0.18, MONITOR.x, MASA.ustYuzey + 0.01, MONITOR.z, mMetal);
  }

  // ── [6] Sandalye ────────────────────────────────────────────────────────
  {
    const sg = SANDALYE.genislik, sd = SANDALYE.derinlik, so = SANDALYE.oturma;
    kutu("sandalye_oturak", sg, 0.06, sd, SANDALYE.x, so, SANDALYE.z, mKoyu)
      .metadata = { capa: "sandalye" };
    kutu("sandalye_sirt", sg, 0.55, 0.06, SANDALYE.x, so + 0.30, SANDALYE.z + sd / 2 - 0.03, mKoyu);
    silindir("sandalye_direk", 0.06, so - 0.12, SANDALYE.x, (so - 0.12) / 2, SANDALYE.z, mMetal);
    // Beş kollu taban — basit yıldız
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const kol = kutu("sandalye_kol", 0.05, 0.04, 0.28,
        SANDALYE.x + Math.sin(a) * 0.12, 0.04, SANDALYE.z + Math.cos(a) * 0.12, mMetal);
      kol.rotation.y = a;
    }
  }

  // ── [7] Beyaz tahta (sol duvar) ─────────────────────────────────────────
  const tahtaYuzey = CreatePlane("tahta_yuzey",
    { width: TAHTA.genislik, height: TAHTA.yukseklik }, sahne);
  {
    // Yüzey +X'e bakar: Y ekseninde -90°.
    tahtaYuzey.position.set(TAHTA.x + 0.03, TAHTA.y, TAHTA.z);
    tahtaYuzey.rotation.y = -Math.PI / 2;
    mBeyaz.backFaceCulling = false;
    tahtaYuzey.material = mBeyaz;
    tahtaYuzey.metadata = { capa: "tahta", yerTutucu: true };
    meshler.push(tahtaYuzey);
    // Çerçeve
    kutu("tahta_cerceve", 0.05, TAHTA.yukseklik + 0.08, TAHTA.genislik + 0.08,
      TAHTA.x, TAHTA.y, TAHTA.z, mMetal);
    // Kalem kanalı
    kutu("tahta_kanal", 0.10, 0.03, TAHTA.genislik, TAHTA.x + 0.05,
      TAHTA.y - TAHTA.yukseklik / 2 - 0.06, TAHTA.z, mMetal);
  }

  // ── [8] Kapı (ön duvar) ─────────────────────────────────────────────────
  {
    kutu("kapi_kanat", KAPI.genislik, KAPI.yukseklik, 0.06, KAPI.x, KAPI.y, KAPI.z, mAhsap)
      .metadata = { capa: "kapi" };
    kutu("kapi_kasa_sol", 0.07, KAPI.yukseklik + 0.1, 0.09,
      KAPI.x - KAPI.genislik / 2, KAPI.y, KAPI.z, mMetal);
    kutu("kapi_kasa_sag", 0.07, KAPI.yukseklik + 0.1, 0.09,
      KAPI.x + KAPI.genislik / 2, KAPI.y, KAPI.z, mMetal);
    kutu("kapi_kasa_ust", KAPI.genislik + 0.14, 0.07, 0.09,
      KAPI.x, KAPI.y + KAPI.yukseklik / 2, KAPI.z, mMetal);
    silindir("kapi_kol", 0.05, 0.10, KAPI.x - KAPI.genislik / 2 + 0.18, 1.05, KAPI.z - 0.06, mVurgu)
      .rotation.x = Math.PI / 2;
  }

  // ── [9] Raf + posterler (dekor; raf ENGELLER'de tanımlı) ────────────────
  {
    const rx = -G / 2 + 0.22, rz = 2.4;
    kutu("raf_govde", 0.44, 1.8, 1.8, rx, 0.9, rz, mAhsap);
    for (const ry of [0.5, 1.0, 1.5]) {
      kutu("raf_kitap", 0.30, 0.24, 1.5, rx + 0.05, ry, rz, mVurgu);
    }

    const poster = (isim: string, dosya: string, x: number, y: number, z: number, dony: number) => {
      const p = CreatePlane(isim, { width: 0.9, height: 1.2 }, sahne);
      p.position.set(x, y, z);
      p.rotation.y = dony;
      const pm = new StandardMaterial(`m_${isim}`, sahne);
      const pt = doku(`d_${isim}`, dosya);
      pm.diffuseTexture = pt;
      pm.emissiveTexture = pt;
      pm.emissiveColor = new Color3(0.35, 0.35, 0.4);
      pm.specularColor = Color3.Black();
      p.material = pm;
      meshler.push(p);
      return p;
    };
    // Sağ duvar: yüzey -X'e baksın → Y'de +90°.
    poster("poster1", "poster-1.png", G / 2 - 0.04, 1.7, -1.2, Math.PI / 2);
    poster("poster2", "poster-2.png", G / 2 - 0.04, 1.7,  0.4, Math.PI / 2);
  }

  // ── [10] Işık — ambient + tek yönlü. Gölge YOK (K2 bütçesi). ───────────
  const ambient = new HemisphericLight("isik_ambient", new Vector3(0, 1, 0), sahne);
  ambient.intensity = 0.62;
  ambient.diffuse = new Color3(0.78, 0.82, 0.95);
  ambient.groundColor = new Color3(0.16, 0.17, 0.24);

  // Yön: pencereden içeriye (arka-üstten öne-aşağıya).
  const gunes = new DirectionalLight("isik_yon", new Vector3(-0.25, -0.75, 0.62), sahne);
  gunes.position = new Vector3(PENCERE.x, 3.0, PENCERE.z - 1);
  gunes.intensity = 0.85;
  gunes.diffuse = new Color3(1.0, 0.96, 0.88);
  // Gölge haritası bilerek kurulmadı: 8GB VRAM tavanı + 60 FPS hedefi.
  // Gerekirse tek bir 1024 CascadedShadowGenerator eklenebilir; MVP'de yok.

  // ── [11] Statik dondurma ────────────────────────────────────────────────
  // Monitör ve tahta HARİÇ her şey dondurulur: onların malzemesi T3/T4
  // tarafından değişecek. Donmuş malzeme sonradan güncellenemez.
  const donmaz = new Set<Mesh>([monitorEkran, tahtaYuzey]);
  for (const m of meshler) {
    m.isPickable = true;
    m.freezeWorldMatrix();
    if (!donmaz.has(m) && m.material) m.material.freeze();
  }

  const kurulum: OdaKurulumu = { meshler, monitorEkran, tahtaYuzey, zemin, seffaflar };
  _sonKurulum = kurulum;
  return kurulum;
}
