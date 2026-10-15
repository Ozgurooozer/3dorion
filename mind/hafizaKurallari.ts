// mind/hafizaKurallari.ts — Hafızaya NE yazılır: SIRALI KURAL TABLOSU (Markov biçimi). Saf. SPIKE 1 (docs/olcum/on-kayit-markov-hafiza-1.md).
//
// MarkovJunior'dan (mxgmn) alınan fikir: kurallar VERİdir, sıralıdır, her adımda uygulanabilen İLK kural çalışır
// (Markov algoritması), kurallar gruplanır (sequence/markov). Izgara ve rastgelelik burada yok: hafıza kararı
// belirlenimli olmalı. Bugünkü kod (`aniSuzgeci.aniKaydi`) AYNI kararı kodla verir; bu dosya aynı kararı tabloyla verir ve
// testle DENK olduğu sınanır (`hafizaKurallari.test.ts`). Denk çıkarsa `aniKaydi` buna devredilir, kopya kural kalmaz.
//
// BİÇİM: tablo JSON'a gidip gelir (özel koşullar ADLA anılır: `ADLI_KOSUL`). Kuralın düzenlenebilir DEĞİŞKENLERİ sonucunun
// sayı alanlarıdır (`degiskenler`): önem, terminalde korunan baş/son satır. Hafıza panelindeki grafik BU TABLODAN türer
// (`grafik`): çizim ayrı bir kopya değil, tablo ile grafik ayrışamaz.
//
// AKIŞ (grup sırası): ELE (at) → İÇERİK (kırp/normalleştir) → ÖNEM. Her grupta İLK eşleşen kural çalışır; hiçbiri yoksa grup
// atlanır. ELE'de eşleşen "at" kaydı hafızaya sokmaz; ÖNEM grubunda kural zorunludur (son kural koşulsuz varsayılan).
"use strict";
import type { Algi } from "../protocol/algi.ts";
import type { AniTuru } from "./hafiza.ts";
import { komutCoz } from "./komutSozlugu.ts";
import { takipEylemi } from "./takipSozu.ts";
import { sohbetEylemi } from "./sohbetKipi.ts";
import { sohbetGurultusuMu, dersiNormallestir, terminalKirp, KOMUT_ONEMI, MIKROFON_ONEMI, TERMINAL_BAS, TERMINAL_SON } from "./aniYardimcilari.ts";

/** Kuralın baktığı kayıt: algıdan türetilmiş, düz veri (adaptör `kayitDan`). */
export interface Kayit {
  algi: Algi["tur"];
  tur: AniTuru;
  icerik: string;
  /** "yeni": söz/hata politikası (selam, komut, ders) açık; "eski": geri alma yolu (yalnız olay/terminal/mikrofon kuralları). */
  politika: "yeni" | "eski";
  /** `duydum`: Ozyn'in ham sözü ve kaynağı. */
  soz?: string;
  kaynak?: "klavye" | "mikrofon";
  /** `terminal`: çıkış kodu. */
  kod?: number;
  /** `sonuc`: niyet sonucunun durumu ve notu. */
  sonucDurum?: string;
  sonucNot?: string;
}

/** Koşulda ADLA anılan özel sınamalar (JSON'da ad olarak durur; kodu burada). */
export type AdliKosul = "selam" | "komut" | "ortam-hatasi" | "test-gecti";

/** Hepsi isteğe bağlı, hepsi VE'lenir; boş koşul her kaydı yakalar. */
export interface Kosul {
  /** Yalnız "yeni" politikada geçerli. */
  yeni?: true;
  algi?: Algi["tur"];
  tur?: AniTuru;
  kaynak?: "klavye" | "mikrofon";
  /** Terminal: "sifirdisi" = çıkış kodu var ve 0 değil. */
  kod?: "sifirdisi";
  adli?: readonly AdliKosul[];
}

export type Sonuc =
  | { islem: "at" }
  | { islem: "kirp"; bas: number; son: number }
  | { islem: "normallestir" }
  | { islem: "onem"; deger: number };

export interface Kural { id: string; aciklama: string; kosul: Kosul; sonuc: Sonuc }
export interface Grup { id: string; ad: string; kurallar: readonly Kural[] }
export type Tablo = readonly Grup[];

const TEST_GECTI = /\b(pass(ed)?\s+\d+|tests?\s+\d+|built in)\b/i;

const ADLI_KOSUL: Readonly<Record<AdliKosul, (r: Kayit) => boolean>> = {
  "selam": (r) => sohbetGurultusuMu(r.soz ?? ""),
  "komut": (r) => { const s = r.soz ?? ""; return !!(komutCoz(s) || takipEylemi(s) || sohbetEylemi(s)); },
  "ortam-hatasi": (r) => r.sonucDurum === "hata" && (r.sonucNot ?? "").startsWith("ortam "),
  "test-gecti": (r) => TEST_GECTI.test(r.icerik),
};

/** Bugünkü politika. Sıra ANLAMLIDIR: grup içinde ilk eşleşen kazanır. */
export const VARSAYILAN_TABLO: Tablo = [
  { id: "ele", ad: "ELE — yazılmayacak olanı at", kurallar: [
    { id: "olay.yazilmaz", aciklama: "Dünya olayı DURUMDUR, anı değil (spec 06 K2); inisiyatif dürtüsü hatırlanacak bir şey değil.",
      kosul: { algi: "olay" }, sonuc: { islem: "at" } },
    { id: "selam.yazilmaz", aciklama: "Selam/sohbet sözü uzun vadeli hafızaya yazılmaz (OB T2-K7).",
      kosul: { yeni: true, algi: "duydum", adli: ["selam"] }, sonuc: { islem: "at" } },
    { id: "ortam-hata.yazilmaz", aciklama: "Ortam parametre hatası: geçerli değerler hata metninde, model aynı turda düzeltir; anı yanlış ipucu olur.",
      kosul: { yeni: true, algi: "sonuc", adli: ["ortam-hatasi"] }, sonuc: { islem: "at" } },
  ] },
  { id: "icerik", ad: "İÇERİK — metni sadeleştir", kurallar: [
    { id: "ders.normallestir", aciklama: "Hata dersinin ayrıntısı (tırnak/parantez) atılır; aynı ders tek anı olur.",
      kosul: { yeni: true, algi: "sonuc" }, sonuc: { islem: "normallestir" } },
    { id: "terminal.kirp", aciklama: "Uzun terminal çıktısı baş + son satıra iner; kırpıldığı metinde yazılıdır.",
      kosul: { algi: "terminal" }, sonuc: { islem: "kirp", bas: TERMINAL_BAS, son: TERMINAL_SON } },
  ] },
  { id: "onem", ad: "ÖNEM — ne kadar yaşasın (1–10)", kurallar: [
    { id: "komut.dusuk", aciklama: "Doğuştan komut sözü yazılır ama düşük önemle; sıkıştırma ve budamada İLK o gider.",
      kosul: { yeni: true, algi: "duydum", adli: ["komut"] }, sonuc: { islem: "onem", deger: KOMUT_ONEMI } },
    { id: "mikrofon", aciklama: "Mikrofon tanıması yanlış olabilir (ölçüldü): klavyedekinin önüne geçmez.",
      kosul: { algi: "duydum", kaynak: "mikrofon" }, sonuc: { islem: "onem", deger: MIKROFON_ONEMI } },
    { id: "konusma", aciklama: "Ozyn'in söyledikleri.", kosul: { tur: "konusma" }, sonuc: { islem: "onem", deger: 8 } },
    { id: "sonuc", aciklama: "Yapamadığı şeyler öğretici.", kosul: { tur: "sonuc" }, sonuc: { islem: "onem", deger: 6 } },
    { id: "terminal.hata", aciklama: "Gerçek başarısızlık (çıkış kodu ≠ 0).",
      kosul: { tur: "terminal", kod: "sifirdisi" }, sonuc: { islem: "onem", deger: 7 } },
    { id: "terminal.test", aciklama: "Test/derleme geçti izi.",
      kosul: { tur: "terminal", adli: ["test-gecti"] }, sonuc: { islem: "onem", deger: 5 } },
    { id: "terminal", aciklama: "Sıradan terminal çıktısı.", kosul: { tur: "terminal" }, sonuc: { islem: "onem", deger: 2 } },
    { id: "olay", aciklama: "Olay (yalnız eski politikada buraya düşer).", kosul: { tur: "olay" }, sonuc: { islem: "onem", deger: 4 } },
    { id: "varsayilan", aciklama: "Başka hiçbir şeye uymayan.", kosul: {}, sonuc: { islem: "onem", deger: 3 } },
  ] },
];

function eslesir(k: Kosul, r: Kayit): boolean {
  if (k.yeni && r.politika !== "yeni") return false;
  if (k.algi !== undefined && k.algi !== r.algi) return false;
  if (k.tur !== undefined && k.tur !== r.tur) return false;
  if (k.kaynak !== undefined && k.kaynak !== (r.kaynak ?? "klavye")) return false;
  if (k.kod === "sifirdisi" && !(r.kod !== undefined && r.kod !== 0)) return false;
  return (k.adli ?? []).every((a) => ADLI_KOSUL[a](r));
}

export type KuralSonucu =
  | { yaz: false; izler: string[] }
  | { yaz: true; icerik: string; onem: number; izler: string[] };

/** Kaydı tablodan geçirir. `izler`: sırayla çalışan kural kimlikleri (karar kaydı için: hangi kural tetikledi). */
export function uygula(kayit: Kayit, tablo: Tablo = VARSAYILAN_TABLO): KuralSonucu {
  let icerik = kayit.icerik;
  let onem: number | null = null;
  const izler: string[] = [];
  for (const g of tablo) {
    const r: Kayit = { ...kayit, icerik };
    const k = g.kurallar.find((x) => eslesir(x.kosul, r));
    if (!k) continue;
    izler.push(k.id);
    const s = k.sonuc;
    if (s.islem === "at") return { yaz: false, izler };
    if (s.islem === "kirp") icerik = terminalKirp(icerik, s.bas, s.son);
    else if (s.islem === "normallestir") icerik = dersiNormallestir(icerik);
    else onem = s.deger;
  }
  if (onem === null) throw new Error("hafıza kural tablosunda ÖNEM kuralı eşleşmedi (son kural koşulsuz olmalı)");
  return { yaz: true, icerik, onem, izler };
}

/** `aniKaydi`nın aldığı şeylerden kural kaydı. */
export function kayitDan(a: Algi, tur: AniTuru, icerik: string, politika: "yeni" | "eski" = "yeni"): Kayit {
  return {
    algi: a.tur, tur, icerik, politika,
    ...(a.tur === "duydum" ? { soz: a.metin, kaynak: a.kaynak ?? "klavye" } : {}),
    ...(a.tur === "terminal" && a.kod !== undefined ? { kod: a.kod } : {}),
    ...(a.tur === "sonuc" ? { sonucDurum: a.sonuc.durum, sonucNot: a.sonuc.not ?? "" } : {}),
  };
}

/** Koşulun insan okuyacağı kısa hâli ("algı=duydum · adlı: selam"); boş koşul "her kayıt". */
export function kosulMetni(k: Kosul): string {
  const p: string[] = [];
  if (k.yeni) p.push("yeni politika");
  if (k.algi !== undefined) p.push(`algı=${k.algi}`);
  if (k.tur !== undefined) p.push(`tür=${k.tur}`);
  if (k.kaynak !== undefined) p.push(`kaynak=${k.kaynak}`);
  if (k.kod === "sifirdisi") p.push("çıkış kodu ≠ 0");
  for (const a of k.adli ?? []) p.push(`${a}`);
  return p.length ? p.join(" · ") : "her kayıt";
}

/** Koşulun kutuya sığan hâli: önek yok, yalnız değerler ("yeni · duydum · komut"). */
export function kosulKisa(k: Kosul): string {
  const p: string[] = [];
  if (k.yeni) p.push("yeni");
  if (k.algi !== undefined) p.push(k.algi);
  if (k.tur !== undefined) p.push(k.tur);
  if (k.kaynak !== undefined) p.push(k.kaynak);
  if (k.kod === "sifirdisi") p.push("kod≠0");
  for (const a of k.adli ?? []) p.push(a);
  return p.length ? p.join(" · ") : "her kayıt";
}

/** Sonucun kısa hâli. */
export function sonucMetni(s: Sonuc): string {
  if (s.islem === "at") return "hafızaya YAZMA";
  if (s.islem === "kirp") return `terminali kırp (baş ${s.bas} + son ${s.son} satır)`;
  if (s.islem === "normallestir") return "hata dersinin ayrıntısını at";
  return `önem = ${s.deger}`;
}

/** Düzenlenebilir değişkenler: kuralın sonucundaki sayı alanları (panelde kutu olarak çıkar). */
export function degiskenler(k: Kural): { ad: string; deger: number }[] {
  const s = k.sonuc;
  if (s.islem === "onem") return [{ ad: "önem", deger: s.deger }];
  if (s.islem === "kirp") return [{ ad: "baş satır", deger: s.bas }, { ad: "son satır", deger: s.son }];
  return [];
}

export interface GrafikDugumu {
  id: string; tur: "giris" | "grup" | "kural" | "cikis"; etiket: string;
  /** Yalnız kural düğümlerinde: neden (aciklama), ne zaman (kosul), ne yapar (sonuc), hangi grupta. */
  aciklama?: string; kosul?: string; sonuc?: string; grup?: string;
  /** Kutuda sığacak kısa koşul ("yeni · duydum · komut"); tamamı `kosul`da. Grup düğümünde: alt başlık. */
  kisa?: string;
  degiskenler?: { ad: string; deger: number }[];
}
export interface GrafikKenari { kimden: string; kime: string; tur: "sonra" | "icerir" | "at" }

/**
 * Hafıza panelindeki bloklar için düğüm/kenar listesi — YALNIZ tablodan. Giriş → grup → grup → … → yaz; her kural bir düğüm
 * (grubundan "içerir" kenarı), "at" kuralı "reddet" çıkışına gider. Kural kimliği düğüm kimliğidir (tekil olmak ZORUNDA).
 */
export function grafik(tablo: Tablo = VARSAYILAN_TABLO): { dugumler: GrafikDugumu[]; kenarlar: GrafikKenari[] } {
  const dugumler: GrafikDugumu[] = [{ id: "giris", tur: "giris", etiket: "algı" }];
  const kenarlar: GrafikKenari[] = [];
  let onceki = "giris";
  for (const g of tablo) {
    // "ELE — yazılmayacak olanı at": başlık "ELE", alt başlık gerisi (kutuda iki satır).
    const [baslik, ...altBaslik] = g.ad.split(" — ");
    dugumler.push({ id: `grup:${g.id}`, tur: "grup", etiket: baslik ?? g.ad, ...(altBaslik.length ? { kisa: altBaslik.join(" — ") } : {}) });
    kenarlar.push({ kimden: onceki, kime: `grup:${g.id}`, tur: "sonra" });
    onceki = `grup:${g.id}`;
    for (const k of g.kurallar) {
      const d = degiskenler(k);
      dugumler.push({ id: k.id, tur: "kural", etiket: k.id, aciklama: k.aciklama, kosul: kosulMetni(k.kosul), kisa: kosulKisa(k.kosul), sonuc: sonucMetni(k.sonuc), grup: g.id, ...(d.length ? { degiskenler: d } : {}) });
      kenarlar.push({ kimden: `grup:${g.id}`, kime: k.id, tur: "icerir" });
      if (k.sonuc.islem === "at") kenarlar.push({ kimden: k.id, kime: "cikis:at", tur: "at" });
    }
  }
  dugumler.push({ id: "cikis:yaz", tur: "cikis", etiket: "hafızaya yaz" }, { id: "cikis:at", tur: "cikis", etiket: "reddet" });
  kenarlar.push({ kimden: onceki, kime: "cikis:yaz", tur: "sonra" });
  return { dugumler, kenarlar };
}
