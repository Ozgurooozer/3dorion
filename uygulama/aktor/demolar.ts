// uygulama/aktor/demolar.ts — spec 45 B9: DÖRT DEMO (lamba, kutu, kılıç, araba) SAF VERİ olarak. Babylon ve DOM YOK; dosya yazmak çağıranın işi.
//
// Demo = aktör ŞABLONU (`aktorSablonu.ts` biçimi, `Content/Actors/<ad>.aktor.json`) + isteğe bağlı GRAFLAR (`Content/Graphs`). Yalnız altyapının ÇALIŞAN yolları kullanılır:
// nesne + çocuk ışık aktörü (`ust`), `tetik`/`hareket`/`soket` bileşenleri, ⚡ dinleme düğümü `olay.aktor_olayi`, `aktor.yaz`, `aktor.hareket_et`.
// Dinleme grafı AÇIK aktör kimliği ister (`@bu` dinlemede çözülemez; spec 45 §6): yerleştirmede kimlikler yeniden üretildiğinden graf, yerleştirmeden SONRA kimliklerle kurulur
// (`...Grafi(kimlikler)`). Şablonla taşınan yalnız graf ADIDIR, graf dosyası değil — bu bilinen sınırdır (defter R32).
"use strict";
import { grafDogrula, type Graf, type GrafBagi, type GrafDugumu } from "../../protocol/graf.ts";
import type { AktorKumesi, AktorSablonu } from "./aktorSablonu.ts";
import { SABLON_SURUMU } from "./aktorSablonu.ts";

export const DEMO_ADLARI = ["lamba", "kutu", "kilic", "araba"] as const;
export type DemoAdi = (typeof DEMO_ADLARI)[number];

/** Yerleştirmeden sonraki gerçek kimlikler: şablon-yerel kimlik → level kimliği (`sablonYerlestir` eşlemesi). */
export type Kimlikler = Readonly<Record<string, string>>;

export interface Demo {
  ad: DemoAdi;
  aciklama: string;
  sablon: AktorSablonu;
  /** Yerleştirilmiş kimliklerle çalışan graflar (⚡ dinleme). Yoksa boş. */
  graflar: (k: Kimlikler) => Graf[];
  /** Demonun denenme tarifi (Ozyn için tek satırlar). */
  nasilDenenir: string[];
}

/** Doğrulanmış graf; biçim hatası fırlatır (demo verisi koddur: bozuksa test ilk koşuda yakalar, çalışma anına sızmaz). */
function graf(ad: string, aciklama: string, dugumler: GrafDugumu[], baglar: [string, string, string, string][]): Graf {
  const r = grafDogrula({ surum: 1, ad, tur: "olay", aciklama, dugumler, baglar: baglar.map(([a, b, c, d]): GrafBagi => ({ kaynak: [a, b], hedef: [c, d] })) });
  if (!r.ok) throw new Error(`demo grafı '${ad}' geçersiz: ${r.hata}`);
  return r.deger;
}

/** "kaynak aktörünün `olay`ı gelince adımları sırayla yürüt" kalıbı: giriş düğümü `o`, adımlar zincir. */
function olayZinciri(ad: string, aciklama: string, kaynak: string, olay: string, adimlar: { tip: string; ayar: Record<string, number | string | boolean> }[]): Graf {
  const dugumler: GrafDugumu[] = [{ id: "o", tip: "olay.aktor_olayi", ayar: { aktor: kaynak, olay }, konum: [40, 40] }];
  const baglar: [string, string, string, string][] = [];
  adimlar.forEach((a, i) => {
    dugumler.push({ id: `a${i}`, tip: a.tip, ayar: a.ayar, konum: [280 + i * 240, 40] });
    baglar.push([i === 0 ? "o" : `a${i - 1}`, "sonra", `a${i}`, "giris"]);
  });
  return graf(ad, aciklama, dugumler, baglar);
}

const kimlik = (k: Kimlikler, yerel: string): string => {
  const v = k[yerel];
  if (v === undefined) throw new Error(`demo kimliği eşlenmedi: '${yerel}' (yerleştirme eşlemesi eksik)`);
  return v;
};

// ── lamba: nesne + çocuk ışık; Ozyn yaklaşınca yanar, uzaklaşınca söner ──
const LAMBA: Demo = {
  ad: "lamba",
  aciklama: "Sokak lambası: Ozyn 2,5 m'ye yaklaşınca ışığı yanar, uzaklaşınca söner (tetik → ⚡ graf → ışık şiddeti).",
  sablon: {
    surum: SABLON_SURUMU, ad: "demo_lamba", aciklama: "lamba: nesne + çocuk ışık + tetik", kok: "s1",
    aktorler: [
      { id: "s1", nesne: { varlik: "PROP_Streetlamp_Slum_MD", konum: [0, 0, 0], donus: 0, olcek: 1, ad: "Demo lamba", bilesenler: [{ id: "b1", tur: "tetik", ad: "Yaklaşma alanı", ayar: { sekil: "kure", yaricap: 2.5, kim: "ozyn" } }] } },
      { id: "s2", isik: { tur: "nokta", ad: "Lamba ışığı", konum: [0, 4, 0], renk: "#ffd9a0", siddet: 0, menzil: 12, ust: "s1" } },
    ],
  },
  graflar: (k) => [
    olayZinciri("demo_lamba_yak", "Ozyn lambaya yaklaşınca ışığı yakar", kimlik(k, "s1"), "tetik.girdi", [{ tip: "aktor.yaz", ayar: { aktor: kimlik(k, "s2"), alan: "siddet", deger: 2.5 } }]),
    olayZinciri("demo_lamba_sondur", "Ozyn uzaklaşınca ışığı söndürür", kimlik(k, "s1"), "tetik.cikti", [{ tip: "aktor.yaz", ayar: { aktor: kimlik(k, "s2"), alan: "siddet", deger: 0 } }]),
  ],
  nasilDenenir: ["Nesneler panelinden 'Demo lamba' seç, Graflar sekmesinde demo_lamba_yak ve demo_lamba_sondur'u ⚡ dinlemeye al", "lambaya 2,5 m yaklaş: ışık yanar; uzaklaş: söner"],
};

// ── kutu: itilir ve incelenir ──
const KUTU: Demo = {
  ad: "kutu",
  aciklama: "Kutu: Ozyn 1,2 m'ye yaklaşınca kutu ileri kayar ve 0,6 sn sonra durur (it); 'incele' olayı üstüne ve altına yayınlanır.",
  sablon: {
    surum: SABLON_SURUMU, ad: "demo_kutu", aciklama: "kutu: tetik + kinematik hareket", kok: "s1",
    aktorler: [
      { id: "s1", nesne: { varlik: "DETAIL_Junction_Box", konum: [0, 0, 0], donus: 0, olcek: 1, ad: "Demo kutu", bilesenler: [
        { id: "b1", tur: "tetik", ad: "İtme alanı", ayar: { sekil: "kure", yaricap: 1.2, kim: "ozyn" } },
        { id: "b2", tur: "hareket", ayar: { azamiHiz: 3, ivme: 30, donmeHizi: 90 } },
      ] } },
    ],
  },
  graflar: (k) => {
    const kutu = kimlik(k, "s1");
    return [
      olayZinciri("demo_kutu_it", "Ozyn yaklaşınca kutu ileri kayar, 0,6 sn sonra durur", kutu, "tetik.girdi", [
        { tip: "aktor.hareket_et", ayar: { aktor: kutu, hiz: 2, donus: 0 } },
        { tip: "akis.bekle", ayar: { ms: 600 } },
        { tip: "aktor.hareket_et", ayar: { aktor: kutu, hiz: 0, donus: 0 } },
      ]),
      olayZinciri("demo_kutu_incele", "'incele' olayı gelince kutu 'incelendi' olayını altlarına yayınlar", kutu, "incele", [
        { tip: "aktor.olay_yayinla", ayar: { aktor: kutu, olay: "incelendi", yon: "alt" } },
      ]),
    ];
  },
  nasilDenenir: ["demo_kutu_it'i ⚡ dinlemeye al; kutuya 1,2 m'den yaklaş: kutu kayar ve durur", "incele: başka graf/olay yoluyla kutu.incele yayınlanır (şimdilik elle, Orion'un 'incele' niyeti yok)"],
};

// ── kılıç: sahipsiz parça; Orion'un eline soketle takılır ──
const KILIC: Demo = {
  ad: "kilic",
  aciklama: "Kılıç: sap ve uç soketli parça. Orion'un sağ eline `beden:orion` + `el_sag` soketiyle takılır (yerleştirme sonrası Details > Hiyerarşi).",
  sablon: {
    surum: SABLON_SURUMU, ad: "demo_kilic", aciklama: "kılıç: soketli nesne (şimdilik direk biçimi; kılıç glb'si yok)", kok: "s1",
    aktorler: [
      { id: "s1", nesne: { varlik: "DETAIL_Power_Line_Pole", konum: [0, 0, 0], donus: 0, olcek: 0.15, ad: "Demo kılıç", bilesenler: [
        { id: "b1", tur: "soket", ad: "Sap", ayar: { ad: "sap", konum: [0, -0.4, 0], donus: [0, 0, 0] } },
        { id: "b2", tur: "soket", ad: "Uç", ayar: { ad: "uc", konum: [0, 0.6, 0], donus: [0, 0, 0] } },
      ] } },
    ],
  },
  graflar: () => [],
  nasilDenenir: ["yerleştir, Details > Hiyerarşi: Üst = beden:orion, Soket = el_sag", "Orion'un eli hareket edince kılıç eliyle gelir"],
};

// ── araba: kinematik sürüş + sürücü soketi + yaklaşma tetiği ──
const ARABA: Demo = {
  ad: "araba",
  aciklama: "Araba: kinematik hareket (azami 12 m/s), sürücü soketi, binme alanı; Ozyn yaklaşınca yavaşça ilerler, uzaklaşınca durur (sürüş grafı).",
  sablon: {
    surum: SABLON_SURUMU, ad: "demo_araba", aciklama: "araba: hareket + sürücü soketi + binme alanı", kok: "s1",
    aktorler: [
      { id: "s1", nesne: { varlik: "ARABA_Basit", konum: [0, 0, 0], donus: 0, olcek: 1, ad: "Demo araba", bilesenler: [
        { id: "b1", tur: "tetik", ad: "Binme alanı", ayar: { sekil: "kure", yaricap: 2.5, kim: "ozyn" } },
        { id: "b2", tur: "soket", ad: "Sürücü", ayar: { ad: "surucu", konum: [0.4, 0.8, 0.2], donus: [0, 0, 0] } },
        { id: "b3", tur: "hareket", ayar: { azamiHiz: 12, ivme: 6, donmeHizi: 90 } },
      ] } },
    ],
  },
  graflar: (k) => {
    const araba = kimlik(k, "s1");
    return [
      olayZinciri("demo_araba_surus", "Ozyn binme alanına girince araba yavaşça ilerler", araba, "tetik.girdi", [{ tip: "aktor.hareket_et", ayar: { aktor: araba, hiz: 4, donus: 0 } }]),
      olayZinciri("demo_araba_dur", "Ozyn binme alanından çıkınca araba durur", araba, "tetik.cikti", [{ tip: "aktor.hareket_et", ayar: { aktor: araba, hiz: 0, donus: 0 } }]),
    ];
  },
  nasilDenenir: ["demo_araba_surus ve demo_araba_dur'u ⚡ dinlemeye al; arabaya yaklaş: gider; uzaklaş: durur"],
};

export const DEMOLAR: Readonly<Record<DemoAdi, Demo>> = { lamba: LAMBA, kutu: KUTU, kilic: KILIC, araba: ARABA };

/**
 * Yerleştirmeden önceki/sonraki level kümesinden şablon-yerel kimliklerin gerçek karşılığı. `sablonYerlestir` yeni aktörleri şablonun sırasıyla (nesneler kendi içinde, ışıklar kendi içinde)
 * sona ekler; eşleme bu sıraya dayanır ve sayı uyuşmazsa fırlatır (sessiz yanlış eşleme graf bağlarını başka aktöre bağlardı).
 */
export function kimlikEsle(sablon: AktorSablonu, once: AktorKumesi, sonra: AktorKumesi): Kimlikler {
  const yeniNesne = (sonra.nesneler ?? []).slice((once.nesneler ?? []).length).map((n) => n.id);
  const yeniIsik = (sonra.isiklar ?? []).slice((once.isiklar ?? []).length).map((i) => i.id);
  const nesneler = sablon.aktorler.filter((a) => a.nesne), isiklar = sablon.aktorler.filter((a) => a.isik);
  if (yeniNesne.length !== nesneler.length || yeniIsik.length !== isiklar.length) {
    throw new Error(`kimlik eşlemesi tutmadı: şablonda ${nesneler.length} nesne/${isiklar.length} ışık, level'a eklenen ${yeniNesne.length}/${yeniIsik.length}`);
  }
  const k: Record<string, string> = {};
  nesneler.forEach((a, i) => { const id = yeniNesne[i]; if (id !== undefined) k[a.id] = id; });
  isiklar.forEach((a, i) => { const id = yeniIsik[i]; if (id !== undefined) k[a.id] = id; });
  return k;
}
