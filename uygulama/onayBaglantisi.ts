// uygulama/onayBaglantisi.ts — Onay kapısı ve odadaki onay paneli (Y/N/Esc), onaylanan komutun terminale yazılması.
//
// Eskiden uygulama/giris.ts'teydi (mimari düzenleme B1–B2). Kapı `mind/onayKapisi.ts`te; burada DOM paneli,
// karar yolu (`onayKarari`) ve klavye bağı kurulur. Köprü sonradan atandığından çağrı anında okunur.
"use strict";
import { OnayKapisi } from "../mind/onayKapisi.ts";
import { riskEtiketi } from "../mind/komutRiski.ts";
import type { Kopru } from "../bridge/kopru.ts";
import type { Monitor } from "../world/surfaces/terminal/monitor.ts";
import type { SemaPaneli } from "../world/surfaces/duvar/sema.ts";
import type { GunlukEkrani } from "../world/surfaces/duvar/gunluk.ts";
import { komutuTerminaleYaz } from "./terminalYazici.ts";
import { PANO_TELLERI } from "./devrePanosu.ts";

export interface OnayBaglantisiGirdisi {
  monitor: Monitor;
  sema: SemaPaneli;
  gunluk: GunlukEkrani;
  altyaziGoster: (metin: string, ms?: number) => void;
  /** Sonradan atanır: çağrı anında okunur. */
  kopru: () => Kopru | null;
}

export interface OnayBaglantisi {
  onayKapisi: OnayKapisi;
  onayPaneliCiz(): void;
  /** Onaylanan komut terminale YAZILIR. `otomatik`: Ozyn'in tuşu değil komut kipi onayladı (spec 26 F2). */
  onayKarari(onaylandi: boolean, otomatik?: boolean): void;
}

export function onayBaglantisiKur(girdi: OnayBaglantisiGirdisi): OnayBaglantisi {
  const { monitor, sema, gunluk, altyaziGoster } = girdi;
  // ── ONAY KAPISI: projedeki tek tehlikeli yetenegin tek gecidi ─────────────
  // Orion komut ONERIR, CALISTIRAMAZ. Calistiran sey Ozyn'in tusudur.
  // Zaman asimiyla "evet" yoktur; suresi dolan oneri DUSER.
  const onayKapisi = new OnayKapisi({
    // Süre TELDEN okunur: panel bunu (teyitle) değiştirebilir. Bekleyen
    // önerinin son tarihi öneri anında dondurulduğu için değişiklik ona
    // geriye dönük uygulanmaz — S0'da onarılan gizli hata buydu.
    zamanAsimiMs: PANO_TELLERI.onay.zamanAsimi,
  });
  const onayPanel = document.getElementById("onay") as HTMLDivElement;
  const onayKomutEl = document.getElementById("onayKomut") as HTMLDivElement;
  const onayRiskEl = document.getElementById("onayRisk") as HTMLDivElement;
  const onayGerekceEl = document.getElementById("onayGerekce") as HTMLDivElement;

  function onayPaneliCiz(): void {
    const b = onayKapisi.bekleyen;
    if (!b) { onayPanel.dataset.acik = "0"; return; }
    onayPanel.dataset.acik = "1";
    onayPanel.dataset.risk = b.risk.seviye;
    onayKomutEl.textContent = b.komut;
    onayRiskEl.textContent = riskEtiketi(b.risk);
    onayGerekceEl.textContent = `Orion: ${b.gerekce}`;
  }

  /** Onaylanan komut terminale YAZILIR. `otomatik`: Ozyn'in tuşu değil komut kipi onayladı (spec 26 F2). */
  function onayKarari(onaylandi: boolean, otomatik = false): void {
    const o = onaylandi ? onayKapisi.onayla() : onayKapisi.reddet();
    onayPaneliCiz();
    if (!o) return;

    if (!onaylandi) {
      console.log(`[ONAY] REDDEDILDI: ${o.komut}`);
      gunluk.ekle("uyari", "onay", `reddedildi: ${o.komut}`);
      sema.vur("onay", "reddedildi");
      girdi.kopru()?.sonuc({ niyet_id: o.id, durum: "hata",
        not: "Ozyn komutu reddetti. Israr etme; baska bir yol oner ya da sor." });
      altyaziGoster("komut reddedildi", 1800);
      return;
    }

    console.log(`[ONAY] ${otomatik ? "OTOMATIK ONAYLANDI" : "ONAYLANDI"} (${o.risk.seviye}): ${o.komut}`);
    gunluk.ekle("iyi", "onay", `${otomatik ? "otomatik çalıştı" : "onaylandı"} (${o.risk.seviye}): ${o.komut}`);
    sema.vur("onay", otomatik ? "otomatik" : "onaylandı");
    // UZAKTAN TERMİNAL (Ozyn, 2026-10-08): Orion nerede olursa olsun. Kapalı terminal ARKA PLANDA
    // açılır; Ozyn'in kamerası ve klavye odağı kaçırılmaz (eskiden `monitoreGec()` ikisini de alıyordu).
    void komutuTerminaleYaz(monitor, o.komut).then(() => {
      girdi.kopru()?.sonuc({ niyet_id: o.id, durum: "bitti",
        not: otomatik ? "The line was typed into the terminal and ran; its result will appear on screen."
          : "Ozyn approved; the line was typed into the terminal. You will see the result on screen." });
      altyaziGoster("komut calistiriliyor", 1800);
    }, (e: unknown) => {
      console.error("[monitor] açılamadı:", e);
      girdi.kopru()?.sonuc({ niyet_id: o.id, durum: "hata", not: "terminal acilamadi; komut calismadi" });
      altyaziGoster("terminal açılamadı — komut çalışmadı", 2600);
    });
  }

  // Onay tuslari. Panel acikken Y/N/Esc; kapaliyken hicbir sey yapmaz.
  addEventListener("keydown", (e) => {
    if (onayKapisi.durum !== "bekliyor") return;
    const t = e.key.toLowerCase();
    if (t === "y") { e.preventDefault(); e.stopPropagation(); onayKarari(true); }
    else if (t === "n" || e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onayKarari(false); }
  }, true);
  return { onayKapisi, onayPaneliCiz, onayKarari };
}
