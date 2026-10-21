// uygulama/graf/cekirdekDugumler.ts — ÇEKİRDEK DÜĞÜMLER (spec 35): olay, akış, desen çağrısı ve sabit veri. Dünyaya dokunmazlar (yetenek kullanmazlar).
//
// Ajan eylemleri (Git, Söyle, Jest…) ve dünya düzenleme (taşı, yarat…) ayrı dosyalarda kaydedilir; bu dosya her grafiğin iskeletidir. Fonksiyon
// giriş/dönüş düğümlerinin pinleri grafiğin kendi `girisler`/`cikislar`ından gelir; onları yorumlayıcı doğrudan işler (burada yalnız pinler).
"use strict";
import type { GrafDegeri, PinTanimi } from "../../protocol/graf.ts";
import { AKIS_GIRIS, AKIS_SONRA, type DugumTanimi } from "./dugumKaydi.ts";
import { BASLA_TIPI, DESEN_CAGIR_TIPI, FONKSIYON_DONUS_TIPI, FONKSIYON_GIRIS_TIPI } from "./grafTurDenetimi.ts";

/** Tekrar düğümünün tavanı: büyük döngü adım tavanına (yorumlayıcı) çarpmadan önce burada nedenle durur. */
export const TEKRAR_AZAMI = 100;
/** Bekle düğümünün tavanı (ms): uzun bekleme için birden çok Bekle (her biri ■ ile kesilir). */
export const BEKLE_AZAMI_MS = 10_000;
export const SIRA_AZAMI = 8;

const yorumlayiciIsler = (): never => { throw new Error("bu düğümü yorumlayıcı doğrudan işler"); };
const sayiMi = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function cekirdekDugumler<Y>(): DugumTanimi<Y>[] {
  return [
    {
      tip: BASLA_TIPI, ad: "▶ Başla", kategori: "olay", olay: true, saf: false,
      aciklama: "Programın başladığı yer. Ozyn ▶ Çalıştır'a basınca buradan yürür (Orion çalıştıramaz).",
      pinler: () => ({ girisler: [], cikislar: [AKIS_SONRA] }),
      calistir: () => ({ sonra: "sonra" }),
    },
    {
      tip: FONKSIYON_GIRIS_TIPI, ad: "Fonksiyon girişi", kategori: "desen", olay: true, saf: false,
      aciklama: "Desenin (kaydedilmiş alt-grafiğin) başladığı yer; çıkışları desenin girişleridir.",
      pinler: (_a, o) => ({ girisler: [], cikislar: [AKIS_SONRA, ...(o.buGraf?.girisler ?? [])] }),
      calistir: yorumlayiciIsler,
    },
    {
      tip: FONKSIYON_DONUS_TIPI, ad: "Fonksiyon dönüşü", kategori: "desen", saf: false,
      aciklama: "Desenin bittiği yer; girişleri desenin çıktılarıdır.",
      pinler: (_a, o) => ({ girisler: [AKIS_GIRIS, ...(o.buGraf?.cikislar ?? [])], cikislar: [] }),
      calistir: yorumlayiciIsler,
    },
    {
      tip: "akis.sira", ad: "Sıra", kategori: "akis", saf: false,
      aciklama: "Çıkışları 0, 1, 2… sırasıyla, her biri bitince ötekini yürütür (dallanma).",
      ayarlar: [{ ad: "cikis", tip: "sayi", varsayilan: 2, en: 2, cok: SIRA_AZAMI, aciklama: "çıkış sayısı" }],
      pinler: (a) => {
        const n = sayiMi(a["cikis"]) ? Math.trunc(a["cikis"]) : 2;
        return { girisler: [AKIS_GIRIS], cikislar: Array.from({ length: Math.min(Math.max(n, 2), SIRA_AZAMI) }, (_, i): PinTanimi => ({ ad: String(i), tip: "akis" })) };
      },
      calistir: (c) => {
        const n = sayiMi(c.ayar["cikis"]) ? Math.min(Math.max(Math.trunc(c.ayar["cikis"]), 2), SIRA_AZAMI) : 2;
        return { dallar: Array.from({ length: n }, (_, i) => ({ pin: String(i) })) };
      },
    },
    {
      tip: "akis.tekrar", ad: "Tekrar", kategori: "akis", saf: false,
      aciklama: `Gövdeyi 'sayi' kez yürütür (en çok ${TEKRAR_AZAMI}); her turda 'indeks' 0'dan başlar. Bitince 'bitti'.`,
      ayarlar: [{ ad: "sayi", tip: "sayi", varsayilan: 3, en: 0, cok: TEKRAR_AZAMI }],
      pinler: () => ({ girisler: [AKIS_GIRIS, { ad: "sayi", tip: "sayi" }], cikislar: [{ ad: "govde", tip: "akis" }, { ad: "bitti", tip: "akis" }, { ad: "indeks", tip: "sayi" }] }),
      calistir: async (c) => {
        const n = await c.giris("sayi");
        if (!sayiMi(n) || !Number.isInteger(n) || n < 0 || n > TEKRAR_AZAMI) throw new Error(`tekrar sayısı 0–${TEKRAR_AZAMI} arası tam sayı olmalı (gelen: ${String(n)})`);
        return { dallar: Array.from({ length: n }, (_, i) => ({ pin: "govde", cikti: { indeks: i } })), sonra: "bitti" };
      },
    },
    {
      tip: "akis.eger", ad: "Eğer", kategori: "akis", saf: false,
      aciklama: "Koşul doğruysa 'dogru', değilse 'yanlis' çıkışından devam eder.",
      pinler: () => ({ girisler: [AKIS_GIRIS, { ad: "kosul", tip: "bool" }], cikislar: [{ ad: "dogru", tip: "akis" }, { ad: "yanlis", tip: "akis" }] }),
      calistir: async (c) => {
        const k = await c.giris("kosul");
        if (typeof k !== "boolean") throw new Error(`koşul true/false olmalı (gelen: ${String(k)})`);
        return { sonra: k ? "dogru" : "yanlis" };
      },
    },
    {
      tip: "akis.bekle", ad: "Bekle", kategori: "akis", saf: false,
      aciklama: `Verilen süre kadar bekler (ms, en çok ${BEKLE_AZAMI_MS}); ■ Durdur beklemeyi hemen keser.`,
      ayarlar: [{ ad: "ms", tip: "sayi", varsayilan: 1000, en: 0, cok: BEKLE_AZAMI_MS }],
      pinler: () => ({ girisler: [AKIS_GIRIS, { ad: "ms", tip: "sayi" }], cikislar: [AKIS_SONRA] }),
      calistir: async (c) => {
        const ms = await c.giris("ms");
        if (!sayiMi(ms) || ms < 0 || ms > BEKLE_AZAMI_MS) throw new Error(`bekleme 0–${BEKLE_AZAMI_MS} ms olmalı (gelen: ${String(ms)})`);
        await c.bekle(ms);
        return { sonra: "sonra" };
      },
    },
    {
      tip: DESEN_CAGIR_TIPI, ad: "Desen", kategori: "desen", saf: false,
      aciklama: "Kaydedilmiş bir deseni (fonksiyon grafiği) tek düğüm olarak çağırır; pinleri desenin giriş/çıkışlarıdır.",
      ayarlar: [{ ad: "desen", tip: "metin", aciklama: "desen adı" }],
      pinler: (a, o) => {
        const ad = a["desen"];
        if (typeof ad !== "string" || !ad) throw new Error("desen adı verilmedi (ayar.desen)");
        const d = o.desen(ad);
        if (!d) throw new Error(`'${ad}' adlı desen yok`);
        if (d.tur !== "fonksiyon") throw new Error(`'${ad}' bir desen (fonksiyon grafiği) değil`);
        return { girisler: [AKIS_GIRIS, ...d.girisler], cikislar: [AKIS_SONRA, ...d.cikislar] };
      },
      calistir: async (c) => {
        const ad = c.ayar["desen"] as string;
        const girdiler: Record<string, unknown> = {};
        // Girişler bu düğümün çözülmüş veri pinleri (= desenin `girisler`i; denetim çalışmadan önce yapıldı).
        for (const p of c.girisAdlari()) girdiler[p] = await c.giris(p);
        return { cikti: await c.desenCagir(ad, girdiler), sonra: "sonra" };
      },
    },
    ...(["sayi", "metin", "bool"] as const).map((tip): DugumTanimi<Y> => ({
      tip: `veri.${tip}`, ad: tip === "sayi" ? "Sayı" : tip === "metin" ? "Metin" : "Doğru/Yanlış", kategori: "veri", saf: true,
      aciklama: "Sabit değer.",
      ayarlar: [{ ad: "deger", tip, ...(tip === "sayi" ? { varsayilan: 0 } : tip === "bool" ? { varsayilan: true } : { varsayilan: "" }) }],
      pinler: () => ({ girisler: [], cikislar: [{ ad: "deger", tip }] }),
      calistir: (c) => ({ cikti: { deger: c.ayar["deger"] as GrafDegeri } }),
    })),
    {
      tip: "veri.karsilastir", ad: "Karşılaştır", kategori: "veri", saf: true,
      aciklama: "İki sayıyı karşılaştırır (a ? b).",
      ayarlar: [{ ad: "islem", tip: "metin", varsayilan: "<", secenekler: ["<", "<=", "==", "!=", ">=", ">"] }],
      pinler: () => ({ girisler: [{ ad: "a", tip: "sayi" }, { ad: "b", tip: "sayi" }], cikislar: [{ ad: "sonuc", tip: "bool" }] }),
      calistir: async (c) => {
        const a = await c.giris("a"), b = await c.giris("b");
        if (!sayiMi(a) || !sayiMi(b)) throw new Error("a ve b sayı olmalı");
        const islem = c.ayar["islem"];
        const sonuc = islem === "<" ? a < b : islem === "<=" ? a <= b : islem === "==" ? a === b : islem === "!=" ? a !== b : islem === ">=" ? a >= b : a > b;
        return { cikti: { sonuc } };
      },
    },
  ];
}
