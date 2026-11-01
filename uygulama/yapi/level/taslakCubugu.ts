// uygulama/yapi/level/taslakCubugu.ts — NESNELER PANELİ "ORION TASLAKLARI" ÇUBUĞU (spec 45 B8). DOM katmanı; kapı ve işlemler `aktor/taslakKapisi.ts` + `taslakIslemleri.ts`.
//
// Orion önerisini `Content/Drafts/<ad>.taslak.json` olarak bırakır; burada listelenir, seçilince KAPIDAN geçirilip özeti gösterilir (okumak zararsızdır). "Onayla" (şablon/grafları diske yazar) ve
// "Reddet" (taslağı siler) YALNIZ GERÇEK TIKLAMAYLA (`isTrusted`): betikten üretilen tık hiçbir şey yapmaz, Orion'un araç yüzeyinde bu işleri yapan yol YOKTUR. Onay şablonu YERLEŞTİRMEZ ve grafı ÇALIŞTIRMAZ.
"use strict";
import { kodlu } from "../../../world/level/cekirdek/aktorHatalari.ts";
import { taslakAdlari, taslakOzeti, type Taslak } from "../../aktor/taslakKapisi.ts";
import { taslakOku, taslakOnayla, taslakReddet, type TaslakDosyalari } from "../../aktor/taslakIslemleri.ts";
import { dugmeYap, el } from "../ortak/dom.ts";

const dugme = dugmeYap("");

export interface TaslakCubuguAyari {
  dosyalar: TaslakDosyalari;
  altyazi: (metin: string, ms?: number) => void;
  /** Hata/başarı izi (kodlu metin; günlüğe giriş çağıranın). */
  iz?: (seviye: "bilgi" | "hata", metin: string) => void;
  /** Onaydan sonra (şablon listesini tazelemek için). */
  onaylandi?: () => void;
}

export function taslakCubuguKur(a: TaslakCubuguAyari): HTMLElement {
  const kok = el("div", "il-tam"); kok.style.flexWrap = "wrap"; kok.style.padding = "4px 0";
  const etiket = el("span", "", "Orion taslakları"); etiket.title = "Orion'un Content/Drafts'a bıraktığı öneriler (onaylamadan hiçbir şey yazılmaz)";
  const sec = el("select"); sec.title = "Content/Drafts taslakları"; sec.style.flex = "1"; sec.style.minWidth = "80px";
  const yenile = dugme("↻", "", "Taslak listesini yenile");
  const onayla = dugme("Onayla", "", "Şablonu ve grafları diske yaz (yalnız gerçek tıklamayla; var olanın üstüne yazmaz; yerleştirmez, çalıştırmaz)");
  const reddet = dugme("Reddet", "", "Taslak dosyasını sil (yalnız gerçek tıklamayla)");
  const ozet = el("pre"); ozet.style.cssText = "flex-basis:100%;margin:2px 0;white-space:pre-wrap;font-size:11px;max-height:140px;overflow:auto";
  kok.append(etiket, sec, yenile, onayla, reddet, ozet);

  let gecerli: Taslak | null = null;
  const bildir = (seviye: "bilgi" | "hata", m: string, ms = 4000): void => { a.altyazi(m, ms); a.iz?.(seviye, m); };
  const durumAyarla = (): void => { onayla.disabled = gecerli === null; reddet.disabled = !sec.value; };

  async function sec_degisti(): Promise<void> {
    gecerli = null; ozet.textContent = ""; durumAyarla();
    if (!sec.value) return;
    const t = await taslakOku(a.dosyalar, sec.value);
    if (!t.ok) { ozet.textContent = `REDDEDİLDİ (onaylanamaz)\n${t.neden}`; a.iz?.("hata", t.neden); durumAyarla(); return; }
    gecerli = t.deger;
    ozet.textContent = taslakOzeti(t.deger).join("\n");
    durumAyarla();
  }

  async function listeyiYenile(): Promise<void> {
    const onceki = sec.value;
    const r = await a.dosyalar.adresler();
    sec.replaceChildren();
    if (!r.ok) { const o = el("option", "", "(liste alınamadı)"); o.value = ""; sec.append(o); bildir("hata", kodlu("AKT-TSL-004", `taslak listesi: ${r.kod}: ${r.mesaj}`)); await sec_degisti(); return; }
    const adlar = taslakAdlari(r.deger);
    if (!adlar.length) { const o = el("option", "", "(taslak yok)"); o.value = ""; sec.append(o); }
    for (const s of adlar) { const o = el("option", "", s); o.value = s; sec.append(o); }
    if (adlar.includes(onceki)) sec.value = onceki;
    await sec_degisti();
  }

  sec.addEventListener("change", () => { void sec_degisti(); });
  yenile.addEventListener("click", () => { yenile.blur(); void listeyiYenile(); });

  onayla.addEventListener("click", (e) => {
    onayla.blur();
    if (!e.isTrusted) return;   // YALNIZ GERÇEK TIKLAMA
    const t = gecerli;
    if (!t) { bildir("hata", "Önce geçerli bir taslak seç"); return; }
    void (async () => {
      const r = await taslakOnayla(a.dosyalar, t);
      if (!r.ok) { bildir("hata", r.neden, 6000); return; }
      bildir("bilgi", `Taslak onaylandı, yazıldı: ${r.deger.yazilan.join(", ")}`);
      if (r.deger.uyari) a.iz?.("hata", r.deger.uyari);
      a.onaylandi?.();
      await listeyiYenile();
    })();
  });

  reddet.addEventListener("click", (e) => {
    reddet.blur();
    if (!e.isTrusted) return;   // YALNIZ GERÇEK TIKLAMA
    const ad = sec.value;
    if (!ad) { bildir("hata", "Önce bir taslak seç"); return; }
    void (async () => {
      const r = await taslakReddet(a.dosyalar, ad);
      if (!r.ok) { bildir("hata", r.neden, 5000); return; }
      bildir("bilgi", `Taslak reddedildi: ${ad}`);
      await listeyiYenile();
    })();
  });

  durumAyarla();
  void listeyiYenile();
  return kok;
}
