// uygulama/yapi/sekans/oynatmaDugmeleri.ts — SEKANS EDİTÖRÜNÜN ▶ Oynat / ■ Durdur / ⟳ Döngü düğmeleri ve durum satırı (spec 36). DOM katmanı.
//
// GÜVENLİK KURALI (spec 35 §1'in sekans hâli, değişmez): sekansı OYNATMAK yalnız Ozyn'in GERÇEK tıklamasıyla — olay `isTrusted` değilse (betikten
// `.click()`, `dispatchEvent`, konsol) yok sayılır. Bekçi (`uygulama/yapi/sekans/sekansBekci.test.ts`) `sekansiOynat(` çağrısının üretimde YALNIZ burada
// (ve `sekansdene` senaryosunun yüzünde) olduğunu ve buradaki çağrının işleyicisinin ÖNCE `isTrusted`a baktığını sınar. Klavye kısayolu YOK.
// ▶ EKRANDAKİ hâli oynatır (graf ▶'sinden farklı: kaydetmek gerekmez — Unreal'da da düzenlenen sekans oynar; ekrandaki ile oynayan ayrışmaz).
// Durdurmak her zaman serbest (güvenlik yönü): ■ `isTrusted` istemez.
"use strict";
import type { SekansOynatici } from "../../sekans/oynatici.ts";
import { kareYazisi } from "../../sekans/editor/zamanEkseni.ts";
import { dugmeYap } from "../ortak/dom.ts";
import type { SekansBaglami } from "./editorBaglami.ts";

const dugme = dugmeYap("sk-dugme");

export function oynatmaDugmeleriKur(b: SekansBaglami, oynatici: SekansOynatici): { ogeler: HTMLElement[]; ciz(): void; satir: HTMLElement } {
  const oynat = dugme("▶ Oynat", "sk-oynat");
  const durdur = dugme("■ Durdur", "sk-durdur", "Oynayan sekansı HEMEN durdur (kol iner, beden durur)");
  const dongu = dugme("⟳ Döngü", "", "Açıkken ▶ oynatma aralığını (yeşil–kırmızı) ■'ye dek tekrarlar");
  const satir = document.createElement("span"); satir.className = "sk-satir";

  oynat.addEventListener("click", (e) => {
    oynat.blur();
    // YALNIZ GERÇEK TIKLAMA: betikten üretilen tık sekansı oynatmaz (çalıştıran Ozyn'in tuşu).
    if (!e.isTrusted) return;
    const o = b.oturum();
    if (!o) return;
    const r = oynatici.sekansiOynat(o.sekans(), { baslangic: o.kare, dongu: o.dongu, ben: null });
    if (!r.ok) b.bildir(`oynatılamadı: ${r.neden}`, "hata");
    b.tazele();
  });
  durdur.addEventListener("click", () => { durdur.blur(); oynatici.durdur(); b.tazele(); });
  dongu.addEventListener("click", () => { dongu.blur(); const o = b.oturum(); if (o) { o.dongu = !o.dongu; b.tazele(); } });

  function ciz(): void {
    const o = b.oturum(), d = oynatici.durum();
    const oynuyor = d.calisiyor !== null;
    oynat.disabled = !o || oynuyor;
    oynat.title = !o ? "açık sekans yok" : oynuyor ? `'${d.calisiyor!.sekans}' oynuyor (■ ile durdur)` : "Ekrandaki sekansı playhead'den oynat (yalnız senin tıklamanla; kaydetmek gerekmez)";
    durdur.disabled = !oynuyor;
    dongu.dataset.acik = o?.dongu ? "1" : "0";
    if (d.calisiyor) { satir.dataset.tur = "oynuyor"; satir.textContent = `▶ ${d.calisiyor.sekans} · ${kareYazisi(oynatici.kare() ?? 0)}${d.calisiyor.plan.dongu ? " · döngü" : ""} · ${d.calisiyor.ajanlar.join(", ")}`; }
    else if (d.son) { satir.dataset.tur = d.son.durum === "bitti" ? "" : d.son.durum; satir.textContent = `${d.son.durum === "bitti" ? "✓" : d.son.durum === "durdu" ? "■" : "✗"} ${d.son.sekans} ${d.son.durum}${d.son.neden ? `: ${d.son.neden}` : ""} · ${kareYazisi(d.son.kare)}`; }
    else { satir.dataset.tur = ""; satir.textContent = "Henüz oynatılmadı: ▶ playhead'den oynatır."; }
    satir.title = satir.textContent;
  }
  return { ogeler: [oynat, durdur, dongu], ciz, satir };
}
