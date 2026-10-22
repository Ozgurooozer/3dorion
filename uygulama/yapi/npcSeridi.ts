// uygulama/yapi/npcSeridi.ts — GRAF SEKMESİ · "NPC'LER" ŞERİDİ (spec 35 dilim 3, NPC sınıfı): kayıt kartları, ＋ Yeni NPC, ⚡ NPC'yi dinlemeye al / bırak,
// Metin (JSON penceresi), Sil (kaldır → .silinenler), ajan durumu. DOM katmanı; Graf sekmesine tek satırla bağlanır (grafSekmesi.ts ≈320 satır).
//
// NPC = bir ajan + onu süren olay grafikleri + parametreler (`protocol/npc.ts`): aynı Nöbetçi grafiği iki NPC'de, iki ayrı parola ve iki ayrı sayaçla.
// GÜVENLİK KURALI DEĞİŞMEZ (spec 35 §1, §4c): "⚡ NPC'yi dinlemeye al" YALNIZ Ozyn'in GERÇEK tıklamasıyla — olay `isTrusted` değilse (betikten `.click()`,
// konsol) yok sayılır. İkinci bir çalıştırma yolu YOK: düğme mevcut `grafDinleyici.dinlemeyeAl`ı NPC kaydıyla çağırır (aynı denetim, kopya, tavanlar).
// Bekçi (npcDavranisi.test.ts) bu dosyayı BİLİNÇLİ İZİN LİSTESİNDE tutar ve buradaki her çağrının işleyicisinin ÖNCE `isTrusted`a baktığını sınar.
// Bırakmak her zaman serbest (güvenlik yönü). Silmek de gerçek tık ister (yanlışlıkla/betikle kayıt kaybı olmasın); kalıcı silme yok.
// Düzenleme Metin ile (dilim 1'in JSON penceresi, `editorPenceresi` deseni): parametreleri satır içi düzenleyen ayrı bir form YAZILMADI.
// DOM testsiz (bu projede tarayıcı test ortamı yok); mantık saf modüllerde (npcDeposu.ts, grafDinleyici.ts). Canlı deneme listesi spec 35 dilim 3.
"use strict";
import type { NpcDeposu, NpcKaydi } from "../graf/npcDeposu.ts";
import { yeniNpcKaydi } from "../graf/npcDeposu.ts";
import type { GrafDinleyici } from "../graf/grafDinleyici.ts";
import type { DurumDegisimi } from "../graf/grafDurumu.ts";
import type { GrafDegeri } from "../../protocol/graf.ts";
import { npcAdiGecerli } from "../../protocol/npc.ts";
import { el } from "./graf/dom.ts";

export interface NpcSeridiAyari {
  depo: NpcDeposu;
  dinleyici: GrafDinleyici;
  /** Olay grafiklerinin adları (yeni NPC'nin grafik seçimi). */
  graflar: () => readonly string[];
  /** Ajan defteri (yeni NPC'nin ajan seçimi). */
  ajanlar: () => readonly { id: string; ad: string }[];
  durum: { ajanOzet(ajan: string): Readonly<Record<string, GrafDegeri>>; ajanSifirla(ajan: string): boolean; dinle(f: (d: DurumDegisimi) => void): () => void };
  /** NPC kaydını JSON penceresinde aç. */
  metinAc: (ad: string) => void;
  hata: () => string | null;
  bildir: (metin: string, ms?: number) => void;
}

const dugme = (metin: string, sinif = "", ipucu = ""): HTMLButtonElement => {
  const b = el("button", `gs-dugme ${sinif}`.trim(), metin); b.type = "button"; if (ipucu) b.title = ipucu; return b;
};
const durumYazisi = (o: Readonly<Record<string, GrafDegeri>>): string => Object.entries(o).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(" · ");

/** Ajan kapsamlı değişkenler (bellekte) satırı + ajan başına "sıfırla": Kontrol et altında ve NPC kartında AYNI gösterim. Durumu olan ajan yoksa null. */
export function ajanDurumuOgesi(durum: NpcSeridiAyari["durum"] & { durumluAjanlar(): string[] }, sonra: () => void): HTMLElement | null {
  const l = durum.durumluAjanlar();
  if (!l.length) return null;
  const d = el("div", "gs-durum", "Ajan durumu (bellekte; o ajanın bütün grafikleri paylaşır):");
  for (const ajan of l) {
    const s = el("div", "gs-alt", `${ajan}: ${durumYazisi(durum.ajanOzet(ajan))} `);
    const b = dugme("sıfırla", "", `${ajan} ajanının değişkenlerini sil`);
    b.addEventListener("click", () => { b.blur(); durum.ajanSifirla(ajan); sonra(); });
    s.append(b); d.append(s);
  }
  return d;
}

export function npcSeridiKur(a: NpcSeridiAyari): { kok: HTMLElement; ciz(): void } {
  const kok = el("div", "gs-sutun");
  const arac = el("div", "gs-npc-arac");
  const dinle = dugme("⚡ NPC'yi dinlemeye al", "gs-dinle", "Seçili NPC'nin bütün grafikleri, o NPC'nin ajanı için dinlemeye alınır (@ben = bu NPC) — yalnız senin tıklamanla; uygulama kapanınca biter");
  const metin = dugme("Metin", "", "NPC kaydını JSON olarak düzenle (ajan, graflar, parametreler: örn. \"parola\")");
  const sil = dugme("Sil", "gs-sil", "Seçili NPC kaydını kaldır (dosya silinmez, .silinenler klasörüne taşınır)");
  const sifirla = dugme("Durumu sıfırla", "", "Seçili NPC'nin ajanının değişkenlerini sil (ziyaret sayacı 0'dan başlar)");
  const yeni = dugme("＋ Yeni NPC", "", "Ad + ajan + grafik: bir grafik (sınıf), birçok NPC (örnek). Parametreleri sonra Metin ile ekle");
  const form = el("div", "gs-yeni"); form.style.display = "none";
  const adGirdi = el("input"); adGirdi.placeholder = "NPC adı (örn. kapi_nobetcisi)"; adGirdi.autocomplete = "off"; adGirdi.spellcheck = false;
  const ajanSec = el("select"), grafSec = el("select");
  const formHata = el("span", "gs-yeni-hata");
  form.append(adGirdi, ajanSec, grafSec, formHata);
  arac.append(dinle, metin, sifirla, sil, yeni);
  const serit = el("div", "gs-serit");
  kok.append(el("div", "gs-baslik", "NPC'ler (bir grafik, birçok ajan · @ben)"), arac, form, serit);

  let secili: string | null = null;
  const kayit = (): NpcKaydi | null => (secili ? a.depo.liste().find((k) => k.ad === secili) ?? null : null);

  function dugmeleriCiz(): void {
    const k = kayit();
    const dinlemede = !!k && a.dinleyici.npcDinlemede(k.ad);
    dinle.textContent = dinlemede ? "⚡ NPC'yi bırak" : "⚡ NPC'yi dinlemeye al";
    dinle.disabled = !k || (!dinlemede && !!k.hata);
    metin.disabled = !k;
    sifirla.disabled = !k?.ajan;
    sil.disabled = !k || dinlemede;
    sil.title = dinlemede ? "Silinemez: dinlemede (önce bırak)" : "Seçili NPC kaydını kaldır (dosya silinmez, .silinenler klasörüne taşınır)";
    sil.textContent = "Sil"; sil.dataset.emin = "0";
  }

  // ── ⚡ NPC dinleme: kurmak YALNIZ gerçek tık; bırakmak serbest ──
  dinle.addEventListener("click", (e) => {
    dinle.blur();
    if (!secili) return;
    if (a.dinleyici.npcDinlemede(secili)) { a.dinleyici.npcBirak(secili); return; }
    // YALNIZ GERÇEK TIKLAMA (▶ ile aynı kural): NPC'yi dinlemeye almak, olay gelince onun grafiklerini çalıştırma İZNİDİR; betik bu izni veremez.
    if (!e.isTrusted) return;
    const npc = a.depo.al(secili);
    if (!npc) { a.bildir(`dinlemeye alınamadı: '${secili}' bozuk ya da yok (Metin ile düzelt)`, 5000); return; }
    const r = a.dinleyici.dinlemeyeAl(npc);
    if (!r.ok) a.bildir(`dinlemeye alınamadı: ${r.neden}`, 6000);
    else a.bildir(`⚡ ${npc.ad} dinlemede (${npc.ajan}: ${npc.graflar.join(", ")}; uygulama kapanınca biter)`, 3000);
  });
  metin.addEventListener("click", () => { metin.blur(); if (secili) a.metinAc(secili); });
  sifirla.addEventListener("click", () => { sifirla.blur(); const j = kayit()?.ajan; if (j) { a.durum.ajanSifirla(j); ciz(); } });

  // ── Sil (iki adım; ikinci adım gerçek tık; kaldırılan .silinenler'e taşınır) ──
  sil.addEventListener("click", (e) => {
    sil.blur();
    if (!secili) return;
    const ad = secili;
    if (sil.dataset.emin !== "1") {
      sil.dataset.emin = "1"; sil.textContent = `Emin misin? '${ad}'`;
      setTimeout(() => { if (sil.dataset.emin === "1") { sil.dataset.emin = "0"; sil.textContent = "Sil"; } }, 4000);
      return;
    }
    if (!e.isTrusted) return;
    a.depo.sil(ad).then(() => { a.bildir(`'${ad}' kaldırıldı (dosya .silinenler klasörüne taşındı)`, 3000); secili = null; ciz(); },
      (err: unknown) => { a.bildir(`silinemedi: ${err instanceof Error ? err.message : String(err)}`, 5000); dugmeleriCiz(); });
  });

  // ── ＋ Yeni NPC: ad + ajan + grafik → kayıt (parametreler boş) → JSON penceresi ──
  const secenekler = (s: HTMLSelectElement, l: readonly { id: string; ad: string }[], bos: string) => {
    s.replaceChildren(...(l.length ? l.map((x) => { const o = el("option", "", x.ad); o.value = x.id; return o; }) : [el("option", "", bos)]));
  };
  const formKapat = () => { form.style.display = "none"; yeni.style.display = ""; adGirdi.value = ""; formHata.textContent = ""; };
  yeni.addEventListener("click", () => {
    yeni.blur();
    secenekler(ajanSec, a.ajanlar(), "(ajan yok)");
    secenekler(grafSec, a.graflar().map((g) => ({ id: g, ad: g })), "(olay grafiği yok)");
    form.style.display = "flex"; yeni.style.display = "none"; adGirdi.focus();
  });
  for (const s of [ajanSec, grafSec]) s.addEventListener("keydown", (e) => e.stopPropagation());
  adGirdi.addEventListener("keyup", (e) => e.stopPropagation());
  adGirdi.addEventListener("keydown", (e) => {
    e.stopPropagation();   // yazarken çubuk kısayolları (1–9, Y) ve oyun tuşları çalışmasın
    if (e.key === "Escape") { formKapat(); return; }
    if (e.key !== "Enter") return;
    e.preventDefault();
    const ad = adGirdi.value.trim();
    if (!npcAdiGecerli(ad)) { formHata.textContent = "geçersiz ad (harf, rakam, _ ve -; boşluk yok)"; return; }
    if (a.depo.liste().some((k) => k.ad === ad)) { formHata.textContent = "bu ad zaten var"; return; }
    if (!ajanSec.value || !a.graflar().includes(grafSec.value)) { formHata.textContent = "ajan ve olay grafiği seç"; return; }
    void a.depo.yeni(yeniNpcKaydi(ad, ajanSec.value, grafSec.value)).then(() => { formKapat(); secili = ad; ciz(); a.metinAc(ad); },
      (err: unknown) => { formHata.textContent = err instanceof Error ? err.message : String(err); });
  });

  // ── kartlar ──
  function kart(k: NpcKaydi): HTMLElement {
    const c = el("div", "gs-kart");
    c.dataset.bozuk = k.hata ? "1" : "0";
    c.dataset.secili = k.ad === secili ? "1" : "0";
    const dinlemede = a.dinleyici.npcDinlemede(k.ad);
    c.dataset.dinliyor = dinlemede ? "1" : "0";
    c.dataset.calisiyor = a.dinleyici.liste().some((x) => x.npc?.ad === k.ad && x.calisiyor) ? "1" : "0";
    const ozet = k.ajan ? durumYazisi(a.durum.ajanOzet(k.ajan)) : "";
    const alt = k.hata ? `bozuk: ${k.hata}` : `${k.ajan} · ${k.graflar.join(", ")}${ozet ? ` · ${ozet}` : ""}`;
    c.title = `${k.ad}\n${alt}\nTık: seç · Çift tık: JSON`;
    c.append(el("div", "gs-ad", `${k.hata ? "⚠" : dinlemede ? "⚡" : "👤"} ${k.ad}`), el("div", "gs-alt", alt));
    c.addEventListener("click", () => { secili = k.ad; ciz(); });
    c.addEventListener("dblclick", () => a.metinAc(k.ad));
    return c;
  }
  function ciz(): void {
    const l = a.depo.liste();
    if (secili && !l.some((k) => k.ad === secili)) secili = null;
    const h = a.hata();
    serit.replaceChildren(...(l.length ? l.map(kart) : [el("div", "gs-bos", h ? `NPC kayıtları yüklenemedi: ${h}` : "Henüz NPC yok. ＋ Yeni NPC: bir grafik (örn. Nöbetçi NPC'li şablonu) + bir ajan.")]));
    dugmeleriCiz();
  }
  // Abonelikler sekme ömrü boyunca açık (Graf sekmesi gibi).
  a.depo.dinle((o) => { if (o.tur === "liste") ciz(); });
  a.dinleyici.dinle(ciz);
  a.durum.dinle((d) => { if (d.kapsam === "ajan") ciz(); });
  return { kok, ciz };
}
