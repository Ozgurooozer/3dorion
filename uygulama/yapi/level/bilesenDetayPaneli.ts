// uygulama/yapi/level/bilesenDetayPaneli.ts — DETAILS "HİYERARŞİ" + "BİLEŞENLER" ÇİZİCİSİ (spec 45 B7; Unreal Details'in Components kısmı). DOM katmanı; satırlar `bilesenDetayModeli.ts`ten (testli).
//
// Hiçbir yazma burada yapılmaz: her giriş çağıranın işlevini çağırır (`bilesenIslemleri.ts` → `levelTanimiDogrula` → `level.ayarla`; reddedilirse eski hâl, neden altyazıda).
// Alan satırları aktörün kendi alanlarıyla AYNI çizici (`alanSatiriCiz`). Yazı alanlarında tuşlar oyuna sızmaz (panel kökü yakalar).
"use strict";
import type { AlanDegeri } from "../../../world/level/cekirdek/bilesen.ts";
import type { LevelTanimi } from "../../../world/level/cekirdek/levelTanimi.ts";
import { BILESEN_TAVANI } from "../../../world/level/cekirdek/bilesenKaydi.ts";
import { dugmeYap, el } from "../ortak/dom.ts";
import { bilesenBolumu } from "./bilesenDetayModeli.ts";
import { alanSatiriCiz } from "./detayPaneli.ts";

const dugme = dugmeYap("");

export interface BilesenDetayGirdisi {
  /** `.il-detay` ızgarası: içine eklenir (aktörün kendi satırlarından SONRA). */
  hedef: HTMLElement;
  tanim: () => LevelTanimi;
  id: string;
  ekle: (tur: string) => void;
  sil: (bilesenId: string) => void;
  ayarYaz: (bilesenId: string, alan: string, deger: AlanDegeri) => void;
  adYaz: (bilesenId: string, ad: string) => void;
  /** `ust` null = bağı çöz. Soket yalnız üst varken. */
  ustYaz: (ust: string | null, soket: string | null) => void;
  /** Yerleştirilmiş glb'deki `soket_<ad>` düğümlerini soket bileşeni olarak ekler (yoksa düğme çizilmez). */
  glbSoketleriniEkle?: () => void;
}

export function bilesenDetayCiz(g: BilesenDetayGirdisi): void {
  const r = bilesenBolumu(g.tanim(), g.id);
  if (!r.ok) { g.hedef.append(el("div", "il-uyari", r.neden)); return; }
  const b = r.deger;

  // ── Hiyerarşi ──
  g.hedef.append(el("div", "il-bolum", "Hiyerarşi (üst aktör + soket; konum/dönüş üste göre yerel olur)"));
  const ustSec = el("select"); ustSec.title = "Bu aktör hangi aktörün (ya da bedenin) çocuğu";
  const yok = el("option", "", "(yok)"); yok.value = ""; ustSec.append(yok);
  const secenekler = b.hiyerarsi.eksik && b.hiyerarsi.ust ? [{ deger: b.hiyerarsi.ust, etiket: `⚠ ${b.hiyerarsi.ust} (level'da yok)` }, ...b.hiyerarsi.ustSecenekleri] : b.hiyerarsi.ustSecenekleri;
  for (const s of secenekler) { const o = el("option", "", s.etiket); o.value = s.deger; ustSec.append(o); }
  ustSec.value = b.hiyerarsi.ust ?? "";
  const soketSec = el("select"); soketSec.title = "Üstteki hangi soket (yoksa aktörün orijini)";
  const soketYok = el("option", "", "(soket yok)"); soketYok.value = ""; soketSec.append(soketYok);
  const soketler = b.hiyerarsi.soket && !b.hiyerarsi.soketSecenekleri.includes(b.hiyerarsi.soket) ? [b.hiyerarsi.soket, ...b.hiyerarsi.soketSecenekleri] : b.hiyerarsi.soketSecenekleri;
  for (const s of soketler) { const o = el("option", "", s); o.value = s; soketSec.append(o); }
  soketSec.value = b.hiyerarsi.soket ?? "";
  soketSec.disabled = !b.hiyerarsi.ust;
  // Üst değişince eski soket yeni üstte olmayabilir: soket sıfırlanır (sessiz uyumsuz bağ bırakma).
  ustSec.addEventListener("change", () => g.ustYaz(ustSec.value === "" ? null : ustSec.value, null));
  soketSec.addEventListener("change", () => g.ustYaz(b.hiyerarsi.ust, soketSec.value === "" ? null : soketSec.value));
  const satir = el("div", "il-tam"); satir.append(ustSec, soketSec);
  g.hedef.append(satir);

  // ── Bileşenler ──
  g.hedef.append(el("div", "il-bolum", `Bileşenler (${b.bilesenler.length}/${BILESEN_TAVANI})`));
  if (!b.bilesenler.length) g.hedef.append(el("div", "il-bos", "Bileşen yok: aşağıdan ekle (ışık, tetik, soket, hareket)"));
  for (const bs of b.bilesenler) {
    const baslik = el("div", "il-tam");
    const ad = el("input"); ad.type = "text"; ad.value = bs.baslik; ad.title = `${bs.id} · ${bs.etiket} — adı değiştirilebilir (boş = türün adı)`;
    ad.addEventListener("change", () => g.adYaz(bs.id, ad.value === bs.etiket ? "" : ad.value));
    const sil = dugme("✕", "", "Bileşeni sil");
    sil.addEventListener("click", () => { sil.blur(); g.sil(bs.id); });
    baslik.append(ad, sil);
    g.hedef.append(baslik);
    for (const s of bs.alanlar) alanSatiriCiz(g.hedef, s, (alan, deger) => g.ayarYaz(bs.id, alan, deger));
    if (bs.olaylar.length) { const o = el("div", "il-uyari", `olaylar: ${bs.olaylar.join(", ")}`); o.style.color = "inherit"; o.style.opacity = "0.7"; g.hedef.append(o); }
  }
  const tur = el("select");
  for (const t of b.ekleyebilir) { const o = el("option", "", t.etiket); o.value = t.tur; tur.append(o); }
  const ekle = dugme("+ Bileşen", "", b.dolu ? "bileşen tavanı doldu" : "Seçili türde bileşen ekle (şema varsayılanlarıyla)");
  ekle.disabled = b.dolu;
  ekle.addEventListener("click", () => { ekle.blur(); g.ekle(tur.value); });
  const ekleSatir = el("div", "il-tam"); ekleSatir.append(tur, ekle);
  if (g.glbSoketleriniEkle) {
    const glb = dugme("glb soketleri", "", "Nesnenin glb'sindeki 'soket_<ad>' adlı boş düğümleri soket bileşeni olarak ekle");
    glb.disabled = b.dolu;
    const f = g.glbSoketleriniEkle;
    glb.addEventListener("click", () => { glb.blur(); f(); });
    ekleSatir.append(glb);
  }
  g.hedef.append(ekleSatir);
}
