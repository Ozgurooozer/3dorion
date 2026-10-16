// uygulama/dunyaDurumu.ts — Beyne her turda giden "dünya durumu" satırı (Orion'un kendi pozu, Ozyn'in mesafesi, terminal, zaman).
//
// Eskiden uygulama/giris.ts'teydi (mimari düzenleme B1–B2). Çerçeve İngilizce (spec 06 §6.8); bağlama yalnız gerekli
// satırlar girer (spec 16).
"use strict";
import type { Oyuncu } from "../world/player/oyuncu.ts";
import type { Avatar } from "../world/avatar/index.ts";
import type { Monitor } from "../world/surfaces/terminal/monitor.ts";
import { odadaSure, sessizlikSozu, gununVakti } from "../mind/zaman.ts";

/** Beynin gördüğü seçili nesne (spec 28): Ozyn'in fareyle gösterdiği; "buraya/buna" sözlerinin göndermesi. */
export interface SeciliDurumu {
  ad: string;
  capa: string | null;
  konum: { x: number; z: number };
  /** Orion'un bu nesneyle yapabildikleri (İngilizce fiil öbekleri). */
  yapabilir: readonly string[];
}

const EYLEM_SOZU: Readonly<Record<string, string>> = { "orion.git": "go there", "orion.bak": "look at it", "orion.otur": "sit on it", "orion.odaklan": "focus on it" };

/** Seçili nesneden beyin durumu: yalnız UYGUN eylemler "yapabilir"e girer (yapamayacağını önermesin). */
export function seciliDurumu(n: { ad: string; capa: string | null; kutu: { x: number; z: number } }, eylemler: readonly { kimlik: string; uygun: boolean }[]): SeciliDurumu {
  return {
    ad: n.ad, capa: n.capa, konum: { x: n.kutu.x, z: n.kutu.z },
    yapabilir: eylemler.filter((e) => e.uygun).map((e) => EYLEM_SOZU[e.kimlik]).filter((x): x is string => x !== undefined),
  };
}

/** Seçili nesnenin tek satırı (LLM bağlamı); seçili yoksa BOŞ (bağlama yalnız gerekli satır girer, spec 16). */
export function seciliSatiri(s: SeciliDurumu | null): string {
  if (!s) return "";
  const yer = s.capa ? `anchor: ${s.capa}` : `at ${s.konum.x.toFixed(1)},${s.konum.z.toFixed(1)}`;
  const yap = s.yapabilir.length ? ` You can: ${s.yapabilir.join(", ")}.` : "";
  return `Ozyn has pointed at "${s.ad}" (${yer}); "this" or "here" in his words means it.${yap}`;
}

export interface DunyaDurumuGirdisi {
  oyuncu: Oyuncu;
  monitor: Monitor;
  /** Dünyanın açıldığı an (ms). */
  acilis: number;
  /** "yonlendirici" (varsayılan) ya da "otomatik" (eski, kıyas için; ham koordinat taşır). */
  hafizaKipi: "otomatik" | "yonlendirici";
  /** Sonradan atananlar: çağrı anında okunur. */
  orion: () => Avatar | null;
  sonKonusma: () => number;
  /** Seçili nesne (Tab + sol tık); yoksa null. */
  secili?: () => SeciliDurumu | null;
}

export function dunyaDurumuKur(girdi: DunyaDurumuGirdisi): () => string {
  const { oyuncu, monitor } = girdi;
  return function dunyaDurumuMetni(): string {
    const o = oyuncu.oyuncuDurumu();
    const a = girdi.orion()?.durum();
    const simdi = Date.now();
    const d = new Date(simdi);
    return [
      // Ham koordinat modele bir şey anlatmıyordu ("position 0.9,-1.2"); yönlendirici kipinde yer adı
      // durum defterinden ve YALNIZ sorulunca gelir (spec 16 F5).
      a ? `You: ${a.poz}${girdi.hafizaKipi === "otomatik" ? `, position ${a.konum.x.toFixed(1)},${a.konum.z.toFixed(1)}` : ""}${a.oturuyor_mu ? ", seated" : ""}.` : "",
      // PROPRİYOSEPSİYON. Yalnızca HAREKET HÂLİNDEYKEN yazılır — duruyorken
      // "hızın 0" demek her tura bir satır ekleyip hiçbir şey söylemez, bağlam
      // ise sadakatin en pahalı kaynağı (spec 06: bağlama giren her satır
      // ölçülür). Aktüatör doyuma girdiği için bu sayı artık gerçek: komut
      // edilen değil, gerçekleşen.
      a && a.hiz !== undefined && a.hiz > 0.05
        ? `You are moving at ${a.hiz.toFixed(1)} m/s${
            a.hedefeKalan !== undefined ? `, ${a.hedefeKalan.toFixed(1)}m left to your target` : ""
          }.`
        : "",
      `Ozyn is ${o.mesafe?.toFixed?.(1) ?? "?"}m away${o.bakiyor ? ", looking at you" : ""}.`,
      o.etkilesim === "monitor" ? "Ozyn is working on your monitor." : "",
      seciliSatiri(girdi.secili?.() ?? null),
      // Spec 13 Faz 2a: terminal açıksa Orion bunu BİLSİN — yoksa "bilgisayarı aç" sonrası komut
      // önermek yerine yeniden açmaya çalışır. UZAKTAN TERMİNAL (2026-10-08): oturmak şart değil —
      // eskiden yalnız masada otururken söyleniyordu ve model önce masaya gitmesi gerektiğini sanıyordu.
      monitor.acikMi() ? "Your desk terminal is open (PowerShell); you can use it from anywhere." : "",
      // ZAMAN — bir varlığın olmazsa olmazı. Bunlar olmadan Orion her turu
      // zamansız bir "şimdi" içinde yaşıyor: ne gün ilerliyor, ne sessizlik
      // birikiyor, ne de "sabahtan beri buradayım" diyebiliyor.
      `It is ${gununVakti(d.getHours())}, ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}.`,
      odadaSure(simdi - girdi.acilis),
      girdi.sonKonusma() ? sessizlikSozu(simdi - girdi.sonKonusma()) : "",
    ].filter(Boolean).join(" ");
  };
}
