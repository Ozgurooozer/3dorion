// uygulama/yapi/level/levelGecisPenceresi.ts — "BU LEVEL'DA AÇ" ONAYI (spec 42 2. aşama; Orion yeni level'a geçer). DOM katmanı; karar `levelGecisiModeli.ts`te (testli).
//
// İçerik gezgininde bir level'a çift tık → bu pencere: level okunur, geçişe uygun mu bakılır (zemin katmanı, geçerli tanım), özet gösterilir. "Aç ve yeniden başlat" projenin
// AÇILIŞ level'ını değiştirir ve uygulamayı yeniden başlatır (canlı geçiş sonraki iş: dünya yıkma/kurma yan etkileri, spec 42 §8). Kaydedilmemiş ışık/nesne
// değişikliği yeniden başlatmada GİDER: pencere bunu söyler. YALNIZ gerçek tıklama/Enter (`isTrusted`); Orion'un araç yüzeyinde bu yolu çağıran bir şey yoktur.
// TUŞLAR OYUNA SIZMAZ; Esc kapatır. Pencere imleç kipinde açılır.
"use strict";
import type { Kopru } from "../../../host/kopru.ts";
import { dugmeYap, el } from "../ortak/dom.ts";
import { gecisiDegerlendir } from "./levelGecisiModeli.ts";
import { yeniLevelPenceresiStiliEkle } from "./yeniLevelPenceresi.ts";

export interface LevelGecisPenceresiAyari {
  kopru: Pick<Kopru, "projeLevelOku" | "projeVarsayilanLevel">;
  /** Şu an açık dünyanın level klasör adı (projenin açılış level'ı); aynıysa "zaten açık" der. */
  acikAd(): Promise<string | null>;
  /** Kaydedilmemiş değişiklik var mı (ışıklar/nesneler paneli rozetleri): yeniden başlatmada gideceği uyarılır. */
  kirliMi(): boolean;
  /** Açılmadan önce: fare serbest olsun. false dönerse açılmaz. */
  izin(): boolean;
  altyazi(metin: string, ms?: number): void;
}
export interface LevelGecisPenceresi { sor(ad: string): Promise<void>; kapat(): void; acikMi(): boolean }

const dugme = dugmeYap("");

export function levelGecisPenceresiKur(a: LevelGecisPenceresiAyari): LevelGecisPenceresi {
  yeniLevelPenceresiStiliEkle();
  const kok = el("div", "yl-kok"); kok.tabIndex = -1; kok.dataset.acik = "0";
  const kutu = el("div", "yl-kutu");
  const kapatD = dugme("✕", "", "Kapat (Esc)");
  const bas = el("div", "yl-bas"); bas.append(el("span", "", "🗺 Level'a geç"), el("span", "yl-bosluk"), kapatD);
  const ozet = el("div"), uyari = el("div", "yl-klasor"), mesaj = el("div", "yl-mesaj");
  const gecD = dugme("Aç ve yeniden başlat", "", "Bu level projenin açılış level'ı olur; uygulama yeniden başlar"); gecD.dataset.ton = "onay";
  const alt = el("div", "yl-alt"); alt.append(gecD);
  kutu.append(bas, ozet, uyari, mesaj, alt); kok.append(kutu);

  let acik = false, hedef: string | null = null;
  const bildir = (m: string, tur: "bilgi" | "hata" | "iyi" = "bilgi") => { mesaj.textContent = m; mesaj.dataset.tur = tur; };

  async function sor(ad: string): Promise<void> {
    if (!acik) {
      if (!a.izin()) { a.altyazi("level geçişi şimdi açılamaz (sohbet, onay ya da odak açık)", 2500); return; }
      acik = true;
      if (!kok.isConnected) document.body.append(kok);
      kok.dataset.acik = "1";
    }
    hedef = null; gecD.disabled = true; bildir("level okunuyor…");
    ozet.replaceChildren(el("b", "", ad)); uyari.textContent = "";
    const okunan = await a.kopru.projeLevelOku(ad);
    if (!okunan.ok) { bildir(`level okunamadı: ${okunan.mesaj}`, "hata"); return; }
    let ham: unknown;
    try { ham = JSON.parse(okunan.deger) as unknown; } catch { bildir("level dosyası JSON değil", "hata"); return; }
    const d = gecisiDegerlendir(ham);
    if (!d.ok) { bildir(d.neden, "hata"); return; }
    if ((await a.acikAd()) === ad) { bildir("bu level zaten açık (projenin açılış level'ı)", "bilgi"); return; }
    ozet.replaceChildren(el("b", "", d.ad), el("div", "yl-klasor", `klasör: ${ad} · ${d.katman} katman · ${d.nesne} nesne · ${d.isik} ışık`));
    uyari.textContent = a.kirliMi() ? "⚠ Kaydedilmemiş değişiklikler var: yeniden başlatınca gider (ışıklar 'Kaydet' ile diske yazılır)." : "Yerleştirme ve zemin kayıtları her level'da ayrı tutulur (ova'nınkiler ova'da kalır, yeni level boş başlar).";
    hedef = ad; gecD.disabled = false;
    bildir(`'${d.ad}' açılış level'ı yapılıp uygulama yeniden başlatılacak.`);
  }

  async function gec(): Promise<void> {
    if (!hedef) return;
    gecD.disabled = true;
    const r = await a.kopru.projeVarsayilanLevel(hedef);
    if (!r.ok) { bildir(`geçilemedi: ${r.mesaj}`, "hata"); gecD.disabled = false; return; }
    if (!r.deger.yeniden) { bildir(r.deger.neden ?? "yeniden başlatılmadı", "bilgi"); return; }
    bildir("uygulama yeniden başlıyor…", "iyi");
    a.altyazi(`'${r.deger.varsayilanLevel}' açılıyor — uygulama yeniden başlıyor`, 3000);
  }

  gecD.addEventListener("click", (e) => { if (e.isTrusted) void gec(); });
  kapatD.addEventListener("click", () => kapat());
  kok.addEventListener("pointerdown", (e) => { if (e.target === kok) kapat(); });
  kok.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); kapat(); return; }
    if (e.key === "Enter" && e.isTrusted && !gecD.disabled) { e.preventDefault(); void gec(); }
  });
  kok.addEventListener("keyup", (e) => e.stopPropagation());
  kok.addEventListener("keypress", (e) => e.stopPropagation());
  kok.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); });

  function kapat(): void { if (!acik) return; acik = false; hedef = null; kok.dataset.acik = "0"; if (document.activeElement && kok.contains(document.activeElement)) (document.activeElement as HTMLElement).blur(); }

  return { sor, kapat, acikMi: () => acik };
}
