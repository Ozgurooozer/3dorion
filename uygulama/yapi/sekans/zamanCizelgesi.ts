// uygulama/yapi/sekans/zamanCizelgesi.ts — SEKANS EDİTÖRÜNÜN ZAMAN ÇİZELGESİ (spec 36 S2): cetvel, satırlar, anahtar elmasları, klip bölümleri, playhead,
// oynatma aralığı; fareyle scrub, kaydır/yakınlaş, seç/kutu seç, anahtar ve bölüm sürükleme. DOM katmanı.
//
// HESAP DOM'DA YAPILMAZ: nerede ne çizileceği ve farenin neye değdiği saf görünüm modelinden (`uygulama/sekans/editor/izDuzeni.ts`, `zamanEkseni.ts`;
// testli); sürüklemenin kuralları oturumdan (`sekansOturumu.ts`: önizleme, yaslama, Shift eksen kısıtı, tek geri al adımı). Burası yalnız çizer ve olayları
// oturuma çevirir. Çizim her değişiklikte baştan (en çok 64 iz × 256 anahtar; ölçülmedi). Canlıda GÖRÜLMEDİ (spec 36 canlı deneme listesi).
"use strict";
import { koselerdenKutu, tekerlekCarpani } from "../../duzenleyici/tuvalMatematigi.ts";
import { SEKANS_FPS } from "../../../protocol/sekans.ts";
import { anahtarKonumlari, anahtarVurus, bolumKutulari, bolumVurus, DUZEN, kesmeKutulari, kesmeVurus, kutudakiAnahtarlar, refAnahtari, satirBul, satirlar, toplamYukseklik, type AnahtarRef } from "../../sekans/editor/izDuzeni.ts";
import { kesmeAyarla, kesmeEkle } from "../../sekans/editor/kameraIslemleri.ts";
import { anahtarEkle, bolumEkle } from "../../sekans/editor/sekansIslemleri.ts";
import { araligaSigdir, cetvelIsaretleri, kareX, xTamKare, zamanKaydir, zamanYakinlastir } from "../../sekans/editor/zamanEkseni.ts";
import { el } from "../ortak/dom.ts";
import type { SekansBaglami } from "./editorBaglami.ts";

type Durum =
  | { tur: "scrub" }
  | { tur: "kaydir"; x0: number; gx: number }
  | { tur: "surukle"; x0: number; y0: number }
  | { tur: "kutu"; x0: number; y0: number; ek: AnahtarRef[] }
  /** Kamera kesmesini sürükle: bırakınca TEK işlem (kesmeAyarla); sürerken yalnız kutu kayar. */
  | { tur: "kesme"; kare: number; x0: number; yeni: number };

export interface ZamanCizelgesi { kok: HTMLElement; ciz(): void; playheadCiz(): void; sigdir(): void; iptal(): boolean }

export function zamanCizelgesiKur(b: SekansBaglami): ZamanCizelgesi {
  const kok = el("div", "sk-zaman"); kok.tabIndex = -1;
  const cetvel = el("div", "sk-cetvel");
  const govde = el("div", "sk-satirlar");
  const playhead = el("div", "sk-playhead");
  const kutu = el("div", "sk-secim-kutusu");
  kok.append(cetvel, govde, playhead, kutu);
  let durum: Durum | null = null;

  const yerel = (e: { clientX: number; clientY: number }) => { const r = govde.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const seciliMi = (o: NonNullable<ReturnType<SekansBaglami["oturum"]>>, r: AnahtarRef) => o.secim.tur === "anahtar" && o.secim.refs.some((x) => refAnahtari(x) === refAnahtari(r));

  function playheadCiz(): void {
    const o = b.oturum();
    if (!o) { playhead.style.display = "none"; return; }
    const k = b.oynayanKare() ?? o.kare;
    playhead.style.display = "";
    playhead.style.left = `${kareX(o.gorunum, k)}px`;
  }

  function ciz(): void {
    const o = b.oturum();
    cetvel.replaceChildren(); govde.replaceChildren();
    if (!o) { govde.append(el("div", "sk-bos", "Açık sekans yok. Yapı çubuğu · Sekans sekmesinden bir sekans aç ya da ＋ Yeni.")); playheadCiz(); return; }
    const s = o.sekans(), g = o.gorunum, gen = kok.clientWidth || 800;
    for (const i of cetvelIsaretleri(g, gen, s.sure_kare)) {
      const c = el("div", "sk-isaret"); c.style.left = `${i.x}px`; c.dataset.buyuk = i.etiket ? "1" : "0"; cetvel.append(c);
      if (i.etiket) { const t = el("div", "sk-etiket", i.etiket); t.style.left = `${i.x}px`; cetvel.append(t); }
    }
    const l = satirlar(s);
    govde.style.height = `${Math.max(toplamYukseklik(l), 60)}px`;
    for (const r of l) {
      const z = el("div", "sk-zsatir"); z.style.top = `${r.y}px`; z.style.height = `${r.h}px`; z.dataset.tur = r.tur;
      if (r.tur === "iz") { z.dataset.gizli = r.iz.gizli ? "1" : "0"; z.dataset.secili = o.seciliIz() === r.iz.id ? "1" : "0"; }
      govde.append(z);
    }
    // Oynatma aralığının dışı gölgeli; yeşil/kırmızı sınır (Unreal'daki başlangıç/bitiş işaretleri).
    const disari = (x0: number, x1: number) => { const d = el("div", "sk-disari"); d.style.left = `${x0}px`; d.style.width = `${Math.max(0, x1 - x0)}px`; govde.append(d); };
    disari(kareX(g, 0), kareX(g, s.aralik.bas)); disari(kareX(g, s.aralik.bit), kareX(g, s.sure_kare));
    for (const [tur, k] of [["bas", s.aralik.bas], ["bit", s.aralik.bit]] as const) { const m = el("div", "sk-sinir"); m.dataset.tur = tur; m.style.left = `${kareX(g, k)}px`; m.title = tur === "bas" ? "▶ başı" : "▶ sonu"; govde.append(m); }
    for (const k of kesmeKutulari(s, l, g)) {
      const kam = (s.kameralar ?? []).find((x) => x.id === k.kamera);
      const d = el("div", "sk-kesme", `${kam?.ad ?? k.kamera}${k.gecis === "yumusak" ? " ↝" : ""}`);
      Object.assign(d.style, { left: `${k.x}px`, width: `${Math.max(2, k.g)}px`, top: `${k.y}px`, height: `${k.h}px` });
      d.dataset.secili = o.secim.tur === "kesme" && o.secim.kare === k.kare ? "1" : "0";
      d.dataset.kare = String(k.kare);
      d.title = `kamera kesmesi · kare ${k.kare}: ${kam?.ad ?? k.kamera}${k.gecis === "yumusak" ? " (yumuşak geçiş)" : ""}
sürükle: kareyi değiştir · tık: Kamera sekmesinde düzenle`;
      govde.append(d);
    }
    for (const k of bolumKutulari(l, g)) {
      const iz = s.izler.find((x) => x.id === k.iz);
      const bl = iz?.tur === "klip" ? iz.bolumler[k.i] : undefined;
      if (!bl) continue;
      const klip = b.klipler.bul(bl.klip);
      const d = el("div", "sk-bolum", bl.klip);
      Object.assign(d.style, { left: `${k.x}px`, width: `${Math.max(2, k.g)}px`, top: `${k.y}px`, height: `${k.h}px` });
      d.dataset.eksik = klip ? "0" : "1";
      d.dataset.secili = o.secim.tur === "bolum" && o.secim.iz === k.iz && o.secim.i === k.i ? "1" : "0";
      const kare = klip ? Math.round(klip.sure * SEKANS_FPS) : null;
      d.title = `${bl.klip} · kare ${bl.baslangic_kare}–${bl.baslangic_kare + bl.uzunluk_kare}${bl.ofset_kare ? ` · klibin ${bl.ofset_kare}. karesinden` : ""}${klip ? "" : "\n✗ kütüphanede YOK: oynatılamaz"}\nsürükle: taşı · sağ kenar: uzat · sol kenar: kırp`;
      if (kare !== null && bl.uzunluk_kare > kare - bl.ofset_kare) {
        const t = el("div", "sk-tasma"); const bas = (kare - bl.ofset_kare) * g.olcek; t.style.left = `${bas}px`; t.style.right = "0"; t.title = "klip burada bitti: son değerinde durur"; d.append(t);
      }
      for (const yan of ["sol", "sag"] as const) { const t = el("div", "sk-tutamak"); t.dataset.yan = yan; d.append(t); }
      govde.append(d);
    }
    const konumlar = anahtarKonumlari(l, g);
    for (const r of l) {
      if (r.tur !== "iz" || r.iz.tur !== "uzuv" || r.iz.anahtarlar.length < 2) continue;
      const a = r.iz.anahtarlar;
      const c = el("div", "sk-cizgi"); const x0 = kareX(g, a[0]!.kare); Object.assign(c.style, { left: `${x0}px`, width: `${kareX(g, a[a.length - 1]!.kare) - x0}px`, top: `${r.y + r.h / 2}px` });
      govde.append(c);
    }
    for (const k of konumlar) {
      const iz = s.izler.find((x) => x.id === k.iz);
      const a = iz?.tur === "uzuv" ? iz.anahtarlar.find((x) => x.kare === k.kare) : undefined;
      const d = el("div", "sk-elmas");
      d.style.left = `${k.x}px`; d.style.top = `${k.y}px`;
      d.dataset.secili = seciliMi(o, k) ? "1" : "0"; d.dataset.yumusatma = a?.yumusatma ?? "dogrusal";
      d.title = `${k.iz} · kare ${k.kare} · ${a?.deger ?? "?"}${iz?.tur === "uzuv" && iz.kanal.startsWith("oteleme") ? " m" : "°"} · geçiş: ${a?.yumusatma}\nsürükle: zaman ↔ / değer ↕ (Shift tek eksen)`;
      govde.append(d);
    }
    playheadCiz();
  }

  function sigdir(): void {
    const o = b.oturum();
    if (!o) return;
    o.gorunum = araligaSigdir(o.sekans().aralik.bas, o.sekans().aralik.bit, kok.clientWidth || 800);
    b.tazele();
  }

  cetvel.addEventListener("pointerdown", (e) => {
    const o = b.oturum();
    if (!o || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation(); kok.focus({ preventScroll: true });
    // Oynarken scrub oynatmayı keser (Unreal: sürüklenen playhead oynatmayı durdurur).
    if (b.oynayanKare() !== null) b.durdur();
    durum = { tur: "scrub" };
    cetvel.setPointerCapture(e.pointerId);
    o.kareyeGit(xTamKare(o.gorunum, yerel(e).x, o.sekans().sure_kare));
    b.tazele();
  });
  cetvel.addEventListener("pointermove", (e) => {
    const o = b.oturum();
    if (!o || durum?.tur !== "scrub") return;
    o.kareyeGit(xTamKare(o.gorunum, yerel(e).x, o.sekans().sure_kare));
    b.tazele();
  });
  cetvel.addEventListener("pointerup", () => { if (durum?.tur === "scrub") durum = null; });

  govde.addEventListener("pointerdown", (e) => {
    const o = b.oturum();
    if (!o) return;
    kok.focus({ preventScroll: true });
    const p = yerel(e);
    if (e.button === 1) { e.preventDefault(); durum = { tur: "kaydir", x0: e.clientX, gx: o.gorunum.x }; govde.setPointerCapture(e.pointerId); return; }
    if (e.button !== 0) return;
    e.preventDefault();
    const l = satirlar(o.sekans());
    const kv = kesmeVurus(kesmeKutulari(o.sekans(), l, o.gorunum), p.x, p.y);
    if (kv !== null) {
      o.secim = { tur: "kesme", kare: kv };
      durum = { tur: "kesme", kare: kv, x0: p.x, yeni: kv };
      govde.setPointerCapture(e.pointerId); b.yanSekmeAc("kamera"); b.tazele();
      return;
    }
    const a = anahtarVurus(anahtarKonumlari(l, o.gorunum), p.x, p.y);
    if (a) {
      if (e.shiftKey) {
        const onceki = o.secim.tur === "anahtar" ? o.secim.refs : [];
        const var_ = onceki.some((x) => refAnahtari(x) === refAnahtari(a));
        o.secim = { tur: "anahtar", refs: var_ ? onceki.filter((x) => refAnahtari(x) !== refAnahtari(a)) : [...onceki, a] };
        b.tazele();
        return;
      }
      if (!seciliMi(o, a)) o.secim = { tur: "anahtar", refs: [a] };
      if (o.secim.tur === "anahtar") o.anahtarSurukleBasla(o.secim.refs);
      durum = { tur: "surukle", x0: e.clientX, y0: e.clientY }; govde.setPointerCapture(e.pointerId); b.tazele();
      return;
    }
    const bv = bolumVurus(bolumKutulari(l, o.gorunum), p.x, p.y);
    if (bv) {
      o.secim = { tur: "bolum", iz: bv.iz, i: bv.i };
      o.bolumSurukleBasla(bv.iz, bv.i, bv.bolge);
      durum = { tur: "surukle", x0: e.clientX, y0: e.clientY }; govde.setPointerCapture(e.pointerId); b.tazele();
      return;
    }
    const r = satirBul(l, p.y);
    if (r?.tur === "baglama" && !e.shiftKey) o.secim = { tur: "baglama", id: r.baglama.id };
    else if (r?.tur === "iz" && !e.shiftKey) o.secim = { tur: "iz", iz: r.iz.id };
    durum = { tur: "kutu", x0: p.x, y0: p.y, ek: e.shiftKey && o.secim.tur === "anahtar" ? o.secim.refs : [] };
    govde.setPointerCapture(e.pointerId);
    b.tazele();
  });

  govde.addEventListener("pointermove", (e) => {
    const o = b.oturum();
    if (!o || !durum) return;
    if (durum.tur === "kaydir") { o.gorunum = { x: durum.gx + (e.clientX - durum.x0), olcek: o.gorunum.olcek }; b.tazele(); return; }
    if (durum.tur === "kesme") {
      const p = yerel(e), d = durum;
      d.yeni = xTamKare(o.gorunum, p.x - d.x0 + kareX(o.gorunum, d.kare), o.sekans().sure_kare);
      const kutuEl = govde.querySelector<HTMLElement>(`.sk-kesme[data-kare="${d.kare}"]`);
      if (kutuEl) kutuEl.style.left = `${kareX(o.gorunum, d.yeni)}px`;
      return;
    }
    if (durum.tur === "surukle") { const r = o.surukle(e.clientX - durum.x0, e.clientY - durum.y0, e.shiftKey); if (r && !r.ok && r.mesaj) b.bildir(r.mesaj, "uyari"); ciz(); return; }
    if (durum.tur === "kutu") {
      const p = yerel(e), k = koselerdenKutu({ x: durum.x0, y: durum.y0 }, p);
      if (k.g + k.h < 4) return;
      Object.assign(kutu.style, { display: "block", left: `${k.x}px`, top: `${k.y + DUZEN.cetvel}px`, width: `${k.g}px`, height: `${k.h}px` });
      const refs = kutudakiAnahtarlar(anahtarKonumlari(satirlar(o.sekans()), o.gorunum), k);
      const ek = durum.ek;   // Shift+sürükle: önceki seçime EKLER
      const hepsi = [...ek, ...refs.filter((r) => !ek.some((x) => refAnahtari(x) === refAnahtari(r)))];
      o.secim = hepsi.length ? { tur: "anahtar", refs: hepsi } : o.secim.tur === "anahtar" ? { tur: "yok" } : o.secim;
      ciz();
    }
  });

  const birak = () => {
    const d = durum;
    durum = null;
    kutu.style.display = "none";
    if (d?.tur === "surukle") b.sonuc(b.oturum()?.surukleBitir() ?? null);
    else if (d?.tur === "kesme") {
      const o = b.oturum();
      if (o && d.yeni !== d.kare) {
        const r = kesmeAyarla(o.sekans(), d.kare, { kare: d.yeni });
        b.sonuc(r.ok ? o.uygula({ ok: true, deger: r.deger.sekans }, `kesme taşındı: kare ${d.kare} → ${r.deger.kare}`, { tur: "kesme", kare: r.deger.kare }) : { ok: false, mesaj: r.hata });
      } else b.tazele();
    }
    else if (d) b.tazele();
  };
  govde.addEventListener("pointerup", birak);
  govde.addEventListener("pointercancel", () => { b.oturum()?.surukleIptal(); durum = null; kutu.style.display = "none"; b.tazele(); });

  // Çift tık: uzuv izine o kareye anahtar (değer: o karedeki), klip izinin boş yerine kütüphanenin İLK klibinden bölüm (Ayrıntılar'dan klibi değiştir).
  govde.addEventListener("dblclick", (e) => {
    const o = b.oturum();
    if (!o) return;
    const p = yerel(e), s = o.sekans(), l = satirlar(s);
    const r = satirBul(l, p.y);
    if (r?.tur === "kamera") {
      const kare = xTamKare(o.gorunum, p.x, s.sure_kare), kam = b.seciliKamera() ?? s.kameralar?.[0]?.id ?? null;
      if (!kam) { b.bildir("önce Kamera sekmesinden bir kamera ekle (＋ Şu anki görünümden)", "uyari"); b.yanSekmeAc("kamera"); return; }
      b.sonuc(o.uygula(kesmeEkle(s, kare, kam), `kamera kesmesi eklendi: kare ${kare}`, { tur: "kesme", kare }));
      return;
    }
    if (r?.tur !== "iz" || bolumVurus(bolumKutulari(l, o.gorunum), p.x, p.y)) return;
    const kare = xTamKare(o.gorunum, p.x, s.sure_kare);
    if (r.iz.tur === "uzuv") { b.sonuc(o.uygula(anahtarEkle(s, r.iz.id, kare), `anahtar eklendi: ${r.iz.id} · kare ${kare}`, { tur: "anahtar", refs: [{ iz: r.iz.id, kare }] })); return; }
    const ad = b.klipler.adlar()[0];
    const klip = ad ? b.klipler.bul(ad) : null;
    if (!ad || !klip) { b.bildir("kütüphanede klip yok (assets/animasyon/ yüklenmedi mi?)", "hata"); return; }
    const izId = r.iz.id;
    const sonuc = o.uygula(bolumEkle(s, izId, ad, kare, Math.round(klip.sure * SEKANS_FPS)), `bölüm eklendi: ${ad} · kare ${kare} (Ayrıntılar'dan klibi değiştir)`);
    if (sonuc.ok) { const iz = o.sekans().izler.find((x) => x.id === izId); const i = iz?.tur === "klip" ? iz.bolumler.findIndex((x) => x.baslangic_kare === kare) : -1; if (i >= 0) o.secim = { tur: "bolum", iz: izId, i }; }
    b.sonuc(sonuc);
  });

  // Tekerlek: imlecin altındaki kare yerinde kalarak yakınlaş (yalnız yatay). Satırları kaydırmak için sol sütunda tekerlek.
  kok.addEventListener("wheel", (e) => {
    const o = b.oturum();
    if (!o) return;
    e.preventDefault();
    // Shift+tekerlek: Windows'ta tarayıcı dikey adımı yataya çevirir (deltaY 0, deltaX dolu) — ikisinden dolu olanı al.
    if (e.shiftKey) { o.gorunum = zamanKaydir(o.gorunum, -(e.deltaY || e.deltaX)); b.tazele(); return; }
    o.gorunum = zamanYakinlastir(o.gorunum, e.clientX - kok.getBoundingClientRect().left, tekerlekCarpani(e.deltaY));
    b.tazele();
  }, { passive: false });

  return {
    kok, ciz, playheadCiz, sigdir,
    iptal() { if (!durum) return false; b.oturum()?.surukleIptal(); durum = null; kutu.style.display = "none"; b.tazele(); return true; },
  };
}
