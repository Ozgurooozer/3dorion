// uygulama/graf/dunyaDugumleri.ts — DÜNYA DEĞİŞKENLERİ (spec 35 dilim 2c): dünyanın o anki durumunu OKUYAN saf düğümler.
//
// Blueprint'te "Get" düğümleri gibi: saat, bir ajanın konumu/meşguliyeti, Ozyn'in konumu ve uzaklığı, bir ajana en yakın nesne. Hepsi SAF (akış pini yok,
// değeri istenince hesaplanır) ve YALNIZ OKUR: dünyayı değiştirmek ajan düğümlerinin (niyet kapısı) işidir. Böylece "saat 12'den önceyse şu konuma git" =
// Saat → Karşılaştır → Eğer → Git(konum), bütün parçalar mevcut düğümlerle bağlanır.
//
// Konum DEĞERİ `{ x, y, z }` (metre, protokol `Vec3`). Düğümler ayrıca `x` ve `z` sayı çıkışı verir: karşılaştırma düğümü sayı ister, "x < 3" konum nesnesiyle
// yazılamaz. Mesafe YATAYDIR (x–z düzlemi): ajanla Ozyn'in göz hizası farkı "yaklaştı" kararına karışmasın.
// Kategori `dunya` (dilim 2b): görsel editörün palette'inde ve "Benim grafiğim" panelindeki "Dünya değişkenleri" kısayolunda bu grup tek yerden çıkar.
"use strict";
import { NESNE_TURLERI } from "../../world/level/cekirdek/anlam.ts";
import type { PinTanimi } from "../../protocol/graf.ts";
import type { Vec3 } from "../../protocol/temel.ts";
import type { DugumTanimi, DugumCalismasi } from "./dugumKaydi.ts";
import type { GrafYetenegi } from "./grafYetenegi.ts";
import { KIM, KIM_AYARI, kimOku, nesneMi } from "./ajanDugumleri.ts";
import { BOOL, gecerliSaat } from "./durumDugumleri.ts";

/** Sayı çıkışı (okunurluk); bool pini Dilim 2'nin `BOOL`u (kopya yok). */
const SAYI = (ad: string): PinTanimi => ({ ad, tip: "sayi" });

/** İki konum arasındaki YATAY uzaklık (m). */
export const yatayMesafe = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);

/** Konum ayarının tavanı (m): ova ölçeği; bunun dışı bir yürüyüş hedefi değil, yazım hatasıdır. */
export const KONUM_AZAMI = 200;

async function ajanGovdesi(c: DugumCalismasi<GrafYetenegi>) {
  const kim = await kimOku(c);
  const g = c.yetenek.ajanDurumu(kim.id);
  if (!g) throw new Error(`${kim.ad}: bedeni hazır değil (henüz yüklenmedi ya da bedensiz ajan)`);
  return { kim, g };
}

function ozynKonumu(c: DugumCalismasi<GrafYetenegi>) {
  const o = c.yetenek.ozynDurumu();
  if (!o) throw new Error("Ozyn'in durumu okunamıyor (bu dünyada oyuncu yok)");
  return o;
}

export function dunyaDugumleri(): DugumTanimi<GrafYetenegi>[] {
  return [
    {
      tip: "saat.simdi", ad: "Saat", kategori: "dunya", saf: true,
      aciklama: "Şimdiki saat (bilgisayarın yerel saati). 'saat' kesirlidir (14:30 → 14.5): 'Karşılaştır' ile \"12'den önce mi\" diye sorulur.",
      pinler: () => ({ girisler: [], cikislar: [SAYI("saat"), SAYI("tam_saat"), SAYI("dakika")] }),
      calistir: (c) => {
        const s = gecerliSaat(c);
        const tam = Math.floor(s);
        return { cikti: { saat: s, tam_saat: tam, dakika: Math.min(59, Math.floor((s - tam) * 60 + 1e-9)) } };
      },
    },
    {
      tip: "veri.konum", ad: "Konum", kategori: "dunya", saf: true,
      aciklama: "Sabit bir nokta (metre; y zemin yüksekliği, genelde 0). 'Git' düğümünün hedefi 'konum' ise buna bağlanır.",
      ayarlar: [
        { ad: "x", tip: "sayi", varsayilan: 0, en: -KONUM_AZAMI, cok: KONUM_AZAMI },
        { ad: "y", tip: "sayi", varsayilan: 0, en: -KONUM_AZAMI, cok: KONUM_AZAMI },
        { ad: "z", tip: "sayi", varsayilan: 0, en: -KONUM_AZAMI, cok: KONUM_AZAMI },
      ],
      pinler: () => ({ girisler: [], cikislar: [{ ad: "konum", tip: "konum" }] }),
      calistir: (c) => ({ cikti: { konum: { x: c.ayar["x"] as number, y: c.ayar["y"] as number, z: c.ayar["z"] as number } } }),
    },
    {
      tip: "ajan.durum", ad: "Ajan durumu", kategori: "dunya", saf: true,
      aciklama: "Bir ajanın gövdesi şu an: konumu (x, z dahil), iş yapıyor mu (yürüyor/oturmaya gidiyor), oturuyor mu. Bedeni yoksa nedenli hata.",
      ayarlar: [KIM_AYARI],
      pinler: () => ({ girisler: [KIM], cikislar: [{ ad: "konum", tip: "konum" }, SAYI("x"), SAYI("z"), BOOL("mesgul"), BOOL("oturuyor")] }),
      calistir: async (c) => {
        const { g } = await ajanGovdesi(c);
        return { cikti: { konum: { ...g.konum }, x: g.konum.x, z: g.konum.z, mesgul: g.mesgul, oturuyor: g.oturuyor } };
      },
    },
    {
      tip: "ozyn.durum", ad: "Ozyn durumu", kategori: "dunya", saf: true,
      aciklama: "Ozyn şu an: konumu (x, z dahil) ve etkileştiği yüzey (monitor, bank… yoksa boş metin).",
      pinler: () => ({ girisler: [], cikislar: [{ ad: "konum", tip: "konum" }, SAYI("x"), SAYI("z"), { ad: "yuzey", tip: "metin" }] }),
      calistir: (c) => {
        const o = ozynKonumu(c);
        return { cikti: { konum: { ...o.konum }, x: o.konum.x, z: o.konum.z, yuzey: o.etkilesim ?? "" } };
      },
    },
    {
      tip: "ozyn.mesafe", ad: "Ozyn'e mesafe", kategori: "dunya", saf: true,
      aciklama: "Bir ajanın Ozyn'e YATAY uzaklığı (metre). 'Karşılaştır' ile \"3 m'den yakın mı\" diye sorulur.",
      ayarlar: [KIM_AYARI],
      pinler: () => ({ girisler: [KIM], cikislar: [SAYI("mesafe")] }),
      calistir: async (c) => {
        const { g } = await ajanGovdesi(c);
        return { cikti: { mesafe: yatayMesafe(g.konum, ozynKonumu(c).konum) } };
      },
    },
    {
      tip: "nesne.en_yakin", ad: "En yakın nesne", kategori: "dunya", saf: true,
      aciklama: "Ajana en yakın nesne (isteğe bağlı tür süzgeci ve en uzak menzil). Eşit uzaklıkta kimlik sırasındaki ilk. Menzilde nesne yoksa nedenli HATA.",
      ayarlar: [
        { ad: "tur", tip: "metin", varsayilan: "", secenekler: ["", ...NESNE_TURLERI], aciklama: "tür süzgeci (boş: hepsi)" },
        { ad: "menzil", tip: "sayi", varsayilan: 0, en: 0, cok: KONUM_AZAMI, aciklama: "en uzak mesafe (m); 0: sınırsız" },
        KIM_AYARI,
      ],
      pinler: () => ({ girisler: [KIM], cikislar: [{ ad: "nesne", tip: "nesne" }, SAYI("mesafe")] }),
      calistir: async (c) => {
        const { kim, g } = await ajanGovdesi(c);
        const tur = (c.ayar["tur"] as string | undefined) ?? "";
        const menzil = (c.ayar["menzil"] as number | undefined) ?? 0;
        const adaylar = c.yetenek.nesneler().filter((n) => nesneMi(n) && (!tur || n.tur === tur));
        let en: { n: (typeof adaylar)[number]; d: number } | null = null;
        for (const n of adaylar) {
          const d = yatayMesafe(g.konum, { x: n.kutu.x, y: 0, z: n.kutu.z });
          if (menzil > 0 && d > menzil) continue;
          if (!en || d < en.d || (d === en.d && n.id < en.n.id)) en = { n, d };
        }
        if (!en) throw new Error(`${kim.ad}'ın yakınında nesne yok${tur ? ` (tür: ${tur})` : ""}${menzil > 0 ? ` (menzil ${menzil} m)` : ""}`);
        return { cikti: { nesne: en.n, mesafe: en.d } };
      },
    },
  ];
}
