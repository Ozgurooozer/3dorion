// uygulama/mikrofon.ts — Mikrofon: bas-konuş (V), aç/kapat (K); Nemotron Speech İngilizce çözer.
//
// Eskiden uygulama/giris.ts'teki `beyniBagla`nın içindeydi (mimari düzenleme B1–B2). Çözülen metin klavyeden
// yazılmış gibi AYNI yoldan geçer (`sozAlindi`): kapı, hafıza, komut sözlüğü değişmez.
"use strict";
import { NemotronGirdi } from "../voice/nemotron.ts";
import type { GunlukEkrani } from "../world/surfaces/duvar/gunluk.ts";

export interface MikrofonGirdisi {
  gunluk: GunlukEkrani;
  altyaziGoster: (metin: string, ms?: number) => void;
  /** Çözülen/yazılan söz buradan beyne gider (klavyeyle aynı yol). */
  sozAlindi: (t: { metin: string; kesin: boolean }, kaynak?: "klavye" | "mikrofon") => void;
}

export function mikrofonKur(girdi: MikrofonGirdisi): void {
  const { gunluk, altyaziGoster, sozAlindi } = girdi;
  // Mikrofon: bas-konuş V, Nemotron Speech İngilizce çözer. Çözülen metin klavyeden yazılmış gibi
  // AYNI yoldan geçer (sozAlindi): kapı, hafıza, komut sözlüğü değişmez.
  // AÇIK/KAPALI: K tuşu. Seçim hatırlanır (localStorage "orion.mikrofon"); ?mikrofon=1 (ORION_MIKROFON=1)
  // o oturum için açar. Kapalıyken Python süreci YOKTUR (RAM/CPU yok). Senaryolarda (`sessiz=1`)
  // hiçbir zaman kendiliğinden açılmaz.
  if (typeof window.kopru?.dinleKomut === "function") {
    const sorgu = new URLSearchParams(location.search);
    const hatirla = (v?: "1" | "0"): string | null => {
      try { if (v) localStorage.setItem("orion.mikrofon", v); return localStorage.getItem("orion.mikrofon"); } catch { return null; }
    };
    const kulak = new NemotronGirdi(window.kopru);
    kulak.dinle((t) => sozAlindi(t, "mikrofon"));
    kulak.hataDinle((h) => { gunluk.ekle("hata", "kulak", h); altyaziGoster(`kulak: ${h}`, 4000); });
    kulak.durumDinle((d) => {
      if (d.d === "yukleniyor") altyaziGoster("kulak yükleniyor (~15 sn)…", 4000);
      else if (d.d === "hazir" && d.mikrofon) { gunluk.ekle("iyi", "kulak", `hazır: ${d.mikrofon} (bas-konuş: V)`); altyaziGoster("kulak hazır: V tuşunu basılı tutup İngilizce konuş", 3500); }
      else if (d.d === "dinliyor") altyaziGoster("dinliyorum… (V basılı)", 30000);
      else if (d.d === "cozuyor") altyaziGoster("çözüyorum…", 3000);
      else if (d.d === "bos") altyaziGoster(d.neden === "sessiz" ? "ses gelmedi (mikrofon seviyesi çok düşük?)" : d.neden === "cok kisa" ? "çok kısa, V'yi basılı tut" : "anlaşılmadı", 2500);
    });
    const yaziAlaniMi = (h: EventTarget | null) => h instanceof HTMLElement && (h.tagName === "INPUT" || h.tagName === "TEXTAREA" || h.isContentEditable);
    let acik = false;
    const kulagiAc = (ac: boolean) => {
      acik = ac;
      hatirla(ac ? "1" : "0");
      if (ac) void kulak.baslat();
      else { kulak.durdur(); altyaziGoster("kulak kapalı (K ile aç)", 2500); gunluk.ekle("bilgi", "kulak", "kapatıldı"); }
    };
    addEventListener("keydown", (e) => {
      if (e.repeat || yaziAlaniMi(e.target)) return;
      if (e.code === "KeyK") kulagiAc(!acik);
      else if (e.code === "KeyV" && acik) kulak.kayitBasla();
    });
    addEventListener("keyup", (e) => { if (e.code === "KeyV") kulak.kayitBitir(); });
    if (!sorgu.has("sessiz") && (sorgu.has("mikrofon") || hatirla() === "1")) kulagiAc(true);
  }
}
