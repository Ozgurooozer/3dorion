// uygulama/yapi/graf/calistirmaDugmeleri.ts — EDİTÖRÜN ▶ Çalıştır / ■ Durdur / ⚡ Dinlemeye al düğmeleri (spec 35 dilim 2b). DOM katmanı.
//
// GÜVENLİK KURALI DEĞİŞMEZ (spec 35 §1, §4c): çalıştırma ve dinlemeye alma YALNIZ Ozyn'in GERÇEK tıklamasıyla — olay `isTrusted` değilse (betikten
// `.click()`, `dispatchEvent`, konsol) yok sayılır. İkinci bir çalıştırma yolu YOK: düğmeler Graf sekmesininkiyle aynı `grafCalistirici.calistir` ve
// `grafDinleyici.dinlemeyeAl`ı çağırır (aynı tek-çalışma, kopya, tavan kuralları). Bekçiler (ajanDugumleri.test.ts "▶ TEK YERDEN", npcDavranisi.test.ts)
// bu dosyayı BİLİNÇLİ İZİN LİSTESİNDE tutar ve buradaki HER çağrının tıklama işleyicisinin ÖNCE `isTrusted`a baktığını sınar.
// ▶ kaydedilmiş hâli çalıştırır (çalıştırıcı depodan okur): sekme kirliyken ▶ gri ve nedenini söyler ("önce Ctrl+S") — ekrandaki ile çalışan ayrışmasın.
// Durdurmak ve bırakmak her zaman serbest (güvenlik yönü): ■ ve "Dinlemeyi bırak" `isTrusted` istemez.
"use strict";
import type { GrafCalistirici } from "../../graf/grafCalistirici.ts";
import type { GrafDinleyici } from "../../graf/grafDinleyici.ts";
import type { GrafDeposu } from "../../graf/grafDeposu.ts";
import { olayTetikleri } from "../../graf/olayDugumleri.ts";
import { dugme } from "./dom.ts";
import type { MesajTuru } from "./editorBaglami.ts";

export interface CalistirmaAyari {
  calistirici: GrafCalistirici;
  dinleyici: GrafDinleyici;
  depo: GrafDeposu;
  /** Etkin sekmenin grafiği ve kirli mi. */
  ad(): string | null;
  kirli(): boolean;
  bildir(metin: string, tur?: MesajTuru): void;
}

export function calistirmaDugmeleriKur(a: CalistirmaAyari): { ogeler: HTMLElement[]; ciz(): void } {
  const calistir = dugme("▶ Çalıştır", "ge-calistir");
  const durdur = dugme("■ Durdur", "ge-durdur", "Süren bütün grafikleri hemen durdur (▶ ve ⚡ olayla çalışanlar; yürüyen ajan da durur, açık diyalog kapanır)");
  const dinle = dugme("⚡ Dinlemeye al", "ge-dinle");

  calistir.addEventListener("click", (e) => {
    calistir.blur();
    // YALNIZ GERÇEK TIKLAMA: betikten üretilen tık programı başlatmaz (spec 35 §1: çalıştıran Ozyn'in tuşu).
    if (!e.isTrusted) return;
    const ad = a.ad();
    if (!ad || a.kirli()) return;
    const r = a.calistirici.calistir(ad);
    if (!r.ok) a.bildir(`çalıştırılamadı: ${r.neden}`, "hata");
  });
  durdur.addEventListener("click", () => { durdur.blur(); a.calistirici.durdur(); a.dinleyici.durdur(); });
  dinle.addEventListener("click", (e) => {
    dinle.blur();
    const ad = a.ad();
    if (!ad) return;
    if (a.dinleyici.dinlemedeMi(ad)) { a.dinleyici.birak(ad); return; }
    // YALNIZ GERÇEK TIKLAMA (▶ ile aynı kural): dinlemeye almak, olay gelince çalıştırma İZNİDİR; betik bu izni veremez.
    if (!e.isTrusted) return;
    if (a.kirli()) return;
    const r = a.dinleyici.dinlemeyeAl(ad);
    if (!r.ok) a.bildir(`dinlemeye alınamadı: ${r.neden}`, "hata");
    else a.bildir(`⚡ ${ad} dinlemede (uygulama kapanınca biter)`, "iyi");
  });

  function ciz(): void {
    const ad = a.ad();
    const k = ad ? a.depo.liste().find((x) => x.ad === ad) ?? null : null;
    const g = ad ? a.depo.al(ad) : null;
    const calisiyor = a.calistirici.durum().calisiyor !== null;
    const kirli = a.kirli();
    const neden = !ad ? "açık grafik yok" : calisiyor ? "zaten bir grafik çalışıyor (■ ile durdur)" : !k ? "dosya yok (silindi ya da adı değişti)" : k.hata ? `kaydedilmiş hâli bozuk: ${k.hata}`
      : k.tur !== "olay" ? "desen tek başına çalışmaz (bir grafikte Desen düğümüyle çağrılır)" : kirli ? "önce kaydet (Ctrl+S): ▶ kaydedilmiş hâli çalıştırır" : "";
    calistir.disabled = neden !== "";
    calistir.title = neden || `'${ad}' çalıştır (yalnız senin tıklamanla; kaydedilmiş hâli)`;
    durdur.disabled = !calisiyor && !a.dinleyici.liste().some((x) => x.calisiyor);
    const dinlemede = !!ad && a.dinleyici.dinlemedeMi(ad);
    dinle.textContent = dinlemede ? "⚡ Dinlemeyi bırak" : "⚡ Dinlemeye al";
    const olaysiz = !!g && g.tur === "olay" && olayTetikleri(g).length === 0;
    const dNeden = dinlemede ? "" : !k ? "dosya yok" : k.hata ? "kaydedilmiş hâli bozuk" : k.tur !== "olay" ? "desen dinlemez" : olaysiz ? "olay düğümü yok ('⚡ Ozyn yaklaştı' gibi bir olay düğümü ekle)" : kirli ? "önce kaydet (Ctrl+S): dinlemeye kaydedilmiş hâl alınır" : "";
    dinle.disabled = dNeden !== "";
    dinle.title = dinlemede ? "Dinlemeyi bırak (süren olay çalışması da durur)" : dNeden || "Olay gelince (Ozyn Flash'a yaklaştı…) çalışsın — yalnız senin tıklamanla; uygulama kapanınca biter";
  }

  return { ogeler: [calistir, durdur, dinle], ciz };
}
