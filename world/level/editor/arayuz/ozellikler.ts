// world/level/editor/arayuz/ozellikler.ts — Seçilinin özellikleri (sağ yuva, spec 22).
//
// Konum / dönüş (derece) / ölçek kutuları: yazılır ya da etiketinden (X/Y/Z) sürüklenir. Çoklu seçimde değerler
// farklıysa kutu boş ("—"): YAZMAK hepsine aynı değeri verir, SÜRÜKLEMEK her birine aynı farkı ekler. Ölçek
// kilidi açıkken üç eksen birlikte. Varlığı değiştir (aynı yerde başka model), grup, gizli/kilitli; işlemler
// (zemine indir, sıfırla, çoğalt, sil) ve çoklu seçimde hizala/dağıt.
"use strict";
import type { Editor } from "../editor.ts";
import type { LevelTanimi, NesneYeri, Vec3 } from "../../cekirdek/levelTanimi.ts";
import { donusVec, olcekVec } from "../../cekirdek/donusum.ts";
import { kisaAd, KATEGORI_ADLARI, type Katalog } from "../../cekirdek/katalog.ts";
import * as K from "../cekirdek/komutlar.ts";
import type { Hal } from "../cekirdek/durum.ts";
import { eylemTusu, type Eylem } from "../cekirdek/kisayol.ts";
import { el, cssEkle, sayiKutusu, oku, yaz } from "./ortak.ts";

const OZ_CSS = `
.ed-oz { padding-bottom: 10px; }
.ed-oz .bas { padding: 8px; border-bottom: 1px solid #1d2638; }
.ed-oz .bas b { display: block; font-size: 13px; color: #e8eefb; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ed-oz .bas small { color: var(--ed-soluk); }
.ed-oz .dugmeler { display: flex; flex-wrap: wrap; gap: 4px; }
.ed-oz select { width: 100%; }
.ed-oz .kilit { cursor: pointer; color: var(--ed-soluk); font-size: 11px; }
.ed-oz .kilit.acik { color: var(--ed-uyari); }
.ed-oz .hiza { display: grid; grid-template-columns: 18px repeat(4, 1fr); gap: 3px; align-items: center; margin: 2px 0; }
.ed-oz .hiza b { color: var(--ed-soluk); font-size: 11px; }
`;

type Alan = "konum" | "donus" | "olcek";
const EKSEN = ["x", "y", "z"] as const;

export interface OzellikPaneli {
  kok: HTMLElement;
  /** Seçime göre ek bölüm (ör. hazır yapı olarak kaydet); null dönerse eklenmez. */
  ekle(f: (sec: NesneYeri[]) => HTMLElement | null): void;
}

export function ozelliklerKur(ed: Editor): OzellikPaneli {
  cssEkle("edOzStil", OZ_CSS);
  const { durum } = ed;
  const kok = el("div", "ed-oz");
  let katalog: Katalog | null = null;
  void ed.katalog().then((k) => { katalog = k; ciz(); }).catch(() => undefined);
  let olcekKilidi = oku<{ v: boolean }>("orion.editor.olcekKilidi", { v: true }).v;
  let surukleOnce: Hal | null = null;
  let bekliyor = false;

  const ipucu = (yazi: string, e: Eylem) => { const t = eylemTusu(e); return t ? `${yazi} (${t})` : yazi; };
  const dugme = (yazi: string, baslik: string, is: () => void) => { const b = el("button", "", yazi); b.title = baslik; b.onclick = () => { is(); b.blur(); }; return b; };
  const satir = (etiket: string, icerik: HTMLElement) => { const s = el("div", "ed-satir"); s.append(el("label", "", etiket), icerik); return s; };
  const bolum = (baslik: string, ...cocuklar: HTMLElement[]) => { const b = el("div", "ed-bolum"); b.append(el("h4", "", baslik), ...cocuklar); return b; };

  const degerler = (t: LevelTanimi, alan: Alan): Vec3[] => secililer(t).map((n) => (alan === "konum" ? n.konum : alan === "donus" ? donusVec(n.donus) : olcekVec(n.olcek)));
  const secililer = (t: LevelTanimi): NesneYeri[] => { const s = new Set(durum.secim()); return (t.nesneler ?? []).filter((n) => n.id && s.has(n.id)); };

  /** Eksen değerini yazan dönüşüm: mutlak (yazınca) ya da fark (sürükleyince). */
  const eksenYaz = (t: LevelTanimi, alan: Alan, eksen: number, v: number, fark: number | null): LevelTanimi => {
    const ids = durum.secim();
    return K.nesneleriDegistir(t, ids, (n) => {
      const d = K.donusumu(n);
      const vec = d[alan];
      const yeni = fark === null ? v : vec[eksen]! + fark;
      if (alan === "olcek" && olcekKilidi) {
        const oran = vec[eksen] ? yeni / vec[eksen]! : 1;
        d.olcek = vec.map((x, i) => (i === eksen ? yeni : x * oran)) as Vec3;
      } else vec[eksen] = yeni;
      if (alan === "olcek") d.olcek = d.olcek.map((x) => Math.max(0.001, x)) as Vec3;
      return K.donusumYaz(n, d);
    }).tanim;
  };

  const vektorSatiri = (t: LevelTanimi, alan: Alan, etiket: string, adim: number) => {
    const vs = degerler(t, alan);
    const kap = el("div", "ed-uclu");
    EKSEN.forEach((e, i) => {
      const ortak = vs.every((v) => Math.abs(v[i]! - vs[0]![i]!) < 1e-6) ? vs[0]![i]! : null;
      let bas: number | null = null;
      kap.append(sayiKutusu({
        etiket: e.toUpperCase(), sinif: e, deger: ortak, adim, basamak: alan === "donus" ? 2 : 3,
        baslarken: () => { surukleOnce = durum.hal(); bas = ortak ?? 0; },
        canli: (v) => { if (!surukleOnce) return; durum.onizle(eksenYaz(surukleOnce.tanim, alan, i, v, ortak === null ? v - (bas ?? 0) : null)); },
        bitti: (v, surukleme) => {
          const once = surukleme ? surukleOnce : null;
          surukleOnce = null;
          const kaynak = once ? once.tanim : durum.tanim();
          const sonuc = eksenYaz(kaynak, alan, i, v, surukleme && ortak === null ? v - (bas ?? 0) : null);
          durum.degistir(() => sonuc, `${etiket} ${e.toUpperCase()} = ${Number(v.toFixed(3))}`, once ? { onceki: once } : { anahtar: `oz:${alan}:${i}` });
        },
      }));
    });
    const s = satir(etiket, kap);
    if (alan === "olcek") {
      const k = el("span", `kilit${olcekKilidi ? " acik" : ""}`, olcekKilidi ? "🔗 eşit" : "⛓ serbest");
      k.title = "Ölçek kilidi: bir ekseni değiştirince diğerleri oranla gelsin";
      k.onclick = () => { olcekKilidi = !olcekKilidi; yaz("orion.editor.olcekKilidi", { v: olcekKilidi }); ciz(); };
      s.firstElementChild!.append(document.createElement("br"), k);
    }
    return s;
  };

  let fircaSurukle = false;
  /** Fırça aracındayken: fırça ayarları (sayı kutuları sürüklenerek) ve fırçadaki varlıklar. */
  const fircaBolumu = (): HTMLElement => {
    const f = durum.ayarlar().firca;
    const yaz = (alan: keyof typeof f, v: unknown) => durum.ayarDegistir((a) => ({ ...a, firca: { ...a.firca, [alan]: v } }));
    const sayi = (etiket: string, alan: "yaricap" | "yogunluk" | "minAralik" | "olcekMin" | "olcekMax", adim: number, min: number) =>
      satir(etiket, sayiKutusu({ etiket: "↔", deger: f[alan], adim,
        baslarken: () => { fircaSurukle = true; },
        canli: (v) => yaz(alan, Math.max(min, v)),
        bitti: (v) => { fircaSurukle = false; yaz(alan, Math.max(min, v)); } }));
    const onay = (etiket: string, alan: "rastgeleDonus" | "normaleHizala") => {
      const l = el("label"); const c = el("input"); c.type = "checkbox"; c.checked = f[alan];
      c.onchange = () => { yaz(alan, c.checked); c.blur(); };
      l.append(c, document.createTextNode(` ${etiket}`)); return l;
    };
    const liste = el("div");
    for (const v of f.varliklar) {
      const r = el("div", "ed-satir");
      const x = el("button", "", "×"); x.title = "fırçadan çıkar"; x.onclick = () => yaz("varliklar", f.varliklar.filter((a) => a !== v));
      r.append(x, el("span", "", kisaAd(v)));
      r.style.gridTemplateColumns = "24px 1fr";
      liste.append(r);
    }
    if (!f.varliklar.length) liste.append(el("div", "ed-ipucu", "Fırça boş — alttaki varlık kartlarına tıklayarak ekle (ağaç, kaya, lamba…)."));
    return bolum("🖌 Fırça",
      el("div", "ed-ipucu", "Sürükleyerek serpiştir · Shift basılı: sil (yalnız fırçadaki varlıklar) · Ctrl+tekerlek: yarıçap · tek vuruş = tek geri al"),
      sayi("Yarıçap (m)", "yaricap", 0.1, 0.5), sayi("Yoğunluk /m²", "yogunluk", 0.005, 0.005), sayi("En az ara (m)", "minAralik", 0.05, 0),
      sayi("Ölçek min", "olcekMin", 0.01, 0.05), sayi("Ölçek maks", "olcekMax", 0.01, 0.05),
      onay("rastgele dönüş", "rastgeleDonus"), onay("yamaca eğ (normale hizala)", "normaleHizala"),
      el("h4", "", "Fırçadaki varlıklar"), liste);
  };

  const ciz = () => {
    if (bekliyor) return;
    // Bir kutuya yazılırken yeniden çizme (odak kaybolur): bırakınca çizilir.
    if (kok.contains(document.activeElement) && (document.activeElement as HTMLElement).matches("input[type=number], input[type=text]")) {
      bekliyor = true;
      (document.activeElement as HTMLElement).addEventListener("blur", () => { bekliyor = false; ciz(); }, { once: true });
      return;
    }
    if (surukleOnce) return;
    const t = durum.tanim();
    const sec = secililer(t);
    const ust = durum.arac() === "firca" ? [fircaBolumu()] : [];
    if (!sec.length) {
      const n = t.nesneler?.length ?? 0;
      kok.replaceChildren(...ust,
        bolum("Seçim yok",
          el("div", "ed-ipucu", `${n} nesne · ${t.gruplar?.length ?? 0} grup · ${ed.level.nesneler.bekleyen()} yükleniyor`),
          el("div", "ed-ipucu", "Sahnede bir nesneye tıkla ya da sahne ağacından seç. Boşlukta sürükleyerek kutu seçimi; Ctrl+A hepsi.")),
      );
      return;
    }
    const tek = sec.length === 1 ? sec[0]! : null;
    const bas = el("div", "bas");
    bas.append(el("b", "", tek ? (tek.ad ?? kisaAd(tek.varlik)) : `${sec.length} nesne`),
      el("small", "", tek ? `${tek.id} · ${tek.varlik}` : [...new Set(sec.map((n) => kisaAd(n.varlik)))].slice(0, 4).join(", ")));

    const donusum = bolum("Dönüşüm",
      vektorSatiri(t, "konum", "Konum (m)", 0.05),
      vektorSatiri(t, "donus", "Dönüş (°)", 1),
      vektorSatiri(t, "olcek", "Ölçek", 0.01),
      (() => {
        const d = el("div", "dugmeler");
        d.append(
          dugme("⤓ Zemine indir", ipucu("Tabanı alttaki yüzeye otur", "zemineIndir"), () => ed.eylem("zemineIndir")),
          dugme("Dönüşü sıfırla", "Dönüş 0°", () => durum.degistir((x) => K.donusumuSifirla(x, durum.secim(), "donus").tanim, "dönüş sıfırlandı")),
          dugme("Ölçeği sıfırla", "Ölçek 1", () => durum.degistir((x) => K.donusumuSifirla(x, durum.secim(), "olcek").tanim, "ölçek sıfırlandı")),
        );
        return d;
      })(),
    );

    // Varlık: aynı yerde başka model (kategoriye göre gruplu).
    const varlikSec = el("select");
    const ortakVarlik = sec.every((n) => n.varlik === sec[0]!.varlik) ? sec[0]!.varlik : "";
    if (!ortakVarlik) varlikSec.add(new Option("— karışık —", ""));
    if (katalog) {
      const gruplar = new Map<string, HTMLOptGroupElement>();
      for (const v of katalog.varliklar) {
        let g = gruplar.get(v.kategori);
        if (!g) { g = document.createElement("optgroup"); g.label = KATEGORI_ADLARI[v.kategori] ?? v.kategori; gruplar.set(v.kategori, g); varlikSec.append(g); }
        g.append(new Option(kisaAd(v.ad), v.ad));
      }
    } else if (ortakVarlik) varlikSec.add(new Option(kisaAd(ortakVarlik), ortakVarlik));
    varlikSec.value = ortakVarlik;
    varlikSec.onchange = () => { if (varlikSec.value) durum.degistir((x) => K.varlikDegistir(x, durum.secim(), varlikSec.value).tanim, `varlık: ${kisaAd(varlikSec.value)}`); };

    const grupSec = el("select");
    grupSec.add(new Option("— grupsuz —", ""));
    for (const g of t.gruplar ?? []) grupSec.add(new Option(g.ad, g.id));
    const ortakGrup = sec.every((n) => n.grup === sec[0]!.grup) ? sec[0]!.grup ?? "" : null;
    if (ortakGrup === null) { grupSec.add(new Option("— karışık —", "*")); grupSec.value = "*"; } else grupSec.value = ortakGrup;
    grupSec.onchange = () => { if (grupSec.value !== "*") durum.degistir((x) => K.grubaTasi(x, durum.secim(), grupSec.value || undefined).tanim, "grup değişti"); };

    const ad = el("input"); ad.type = "text"; ad.value = tek?.ad ?? ""; ad.placeholder = tek ? kisaAd(tek.varlik) : "(çoklu seçimde ad yok)"; ad.disabled = !tek;
    ad.onchange = () => { if (tek) durum.degistir((x) => K.adlandir(x, tek.id!, ad.value).tanim, `ad: ${ad.value}`); };
    ad.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") ad.blur(); };

    const bilgi = bolum("Nesne", satir("Ad", ad), satir("Varlık", varlikSec), satir("Grup", grupSec),
      (() => {
        const d = el("div", "dugmeler");
        d.append(
          dugme("◎ Odakla", ipucu("Kamerayı seçime getir", "odakla"), () => ed.eylem("odakla")),
          dugme("⧉ Çoğalt", ipucu("Yanına kopyala", "cogalt"), () => ed.eylem("cogalt")),
          dugme("👁 Gizle", ipucu("Gizle", "gizle"), () => ed.eylem("gizle")),
          dugme("🔒 Kilitle", ipucu("Kilitle", "kilitle"), () => ed.eylem("kilitle")),
          dugme("📁 Grupla", ipucu("Yeni gruba al", "grupla"), () => ed.eylem("grupla")),
          dugme("🗑 Sil", ipucu("Sil", "sil"), () => ed.eylem("sil")),
        );
        return d;
      })());

    const parcalar: HTMLElement[] = [...ust, bas, donusum, bilgi];
    if (sec.length >= 2) {
      const hiza = bolum("Hizala / dağıt");
      (["X", "Y", "Z"] as const).forEach((e, i) => {
        const r = el("div", "hiza");
        const eksen = i as 0 | 1 | 2;
        r.append(el("b", "", e),
          dugme("min", `${e} ekseninde en küçük kenara hizala`, () => ed.hizala(eksen, "min")),
          dugme("orta", `${e} ekseninde ortaya hizala`, () => ed.hizala(eksen, "orta")),
          dugme("maks", `${e} ekseninde en büyük kenara hizala`, () => ed.hizala(eksen, "maks")),
          dugme("dağıt", `${e} ekseninde eşit aralıkla dağıt (uçtakiler yerinde; en az 3)`, () => ed.dagit(eksen)));
        hiza.append(r);
      });
      parcalar.push(hiza);
    }
    parcalar.push(...ozelEkler.map((f) => f(sec)).filter((x): x is HTMLElement => !!x));
    kok.replaceChildren(...parcalar);
  };

  const ozelEkler: ((sec: NesneYeri[]) => HTMLElement | null)[] = [];
  durum.abone("secim", ciz);
  durum.abone("tanim", ciz);
  durum.abone("arac", ciz);
  let sonFirca = JSON.stringify(durum.ayarlar().firca);
  durum.abone("ayarlar", () => { const f = JSON.stringify(durum.ayarlar().firca); if (f !== sonFirca) { sonFirca = f; if (durum.arac() === "firca" && !fircaSurukle) ciz(); } });
  ed.level.nesneler.yuklenince(() => { if (!durum.secim().length) ciz(); });
  ciz();
  return { kok, ekle(f) { ozelEkler.push(f); ciz(); } };
}
