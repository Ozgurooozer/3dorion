// uygulama/dunyaKancasi.ts — Konsol/MCP deneme yüzeyi (`window.dunya`) ve hızlı deneme tuşları (1-6).
//
// Eskiden uygulama/giris.ts'teydi (mimari düzenleme B1–B2). Bir DEBUG yüzeyi: protokol değil, köprü değil.
// Niyet verirken doğrulama ATLANMAZ (protokolün kendi doğrulayıcısı).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { KameraRig } from "../world/engine/kamera.ts";
import type { Oyuncu } from "../world/player/oyuncu.ts";
import type { Avatar } from "../world/avatar/index.ts";
import type { Tahta } from "../world/surfaces/tahta/tahta.ts";
import type { Monitor } from "../world/surfaces/terminal/monitor.ts";
import { capaKonumu } from "../world/level/capaGeometri.ts";
import { niyetDogrula } from "../protocol/dogrula.ts";
import type { Niyet } from "../protocol/niyet.ts";
import type { Odak } from "./odak.ts";
import type { Yerler, YerGecisi } from "./yerGecisi.ts";

export interface DunyaKancasiGirdisi {
  sahne: Scene; rig: KameraRig; oyuncu: Oyuncu; tahta: Tahta; monitor: Monitor; odak: Odak;
  yerler: Yerler; gecis: YerGecisi;
  altyaziGoster: (metin: string, ms?: number) => void;
  niyetiYurut: (n: Niyet, id: string) => void;
  /** Orion'un gözünden kare (giris.ts'te kurulan göz). */
  orionKaresi: (en?: number, boy?: number, yaw?: number) => Promise<unknown>;
  /** Sonradan atanır: çağrı anında okunur. */
  orion: () => Avatar | null;
}

export function dunyaKancasiKur(girdi: DunyaKancasiGirdisi): void {
  const { sahne, rig, oyuncu, tahta, monitor, odak, yerler, gecis, altyaziGoster, niyetiYurut, orionKaresi } = girdi;
  // ── Demo kancası (T7): sinematik çekim konsoldan tetiklenebilsin ───────────
  // `window.dunya.sinematik("tahta")` → kamera tahtayı çerçeveler.
  // Bu bir DEBUG yüzeyi; protokol değil, köprü değil.
  const dunyaKancasi = {
    sinematik(capa: string, sure = 4): boolean {
      const k = capaKonumu(capa, yerler.ozyn.capalar);
      if (!k) { console.warn(`[dunya] bilinmeyen çapa: ${capa}. Geçerli: ${yerler.ozyn.capalar.map((c) => c.ad).join(", ")}`); return false; }
      rig.sinematikBak(k, 2.6, 0.7, sure);
      return true;
    },
    oyuncuDurumu: () => oyuncu.oyuncuDurumu(),
    capalar: () => yerler.ozyn.capalar.map((c) => c.ad),

    /**
     * Orion'a elle niyet gönder — T4 (köprü) gelene kadar deneme yüzeyi.
     * Örnek: dunya.niyet("git", { hedef: { tip: "capa", ad: "tahta" } })
     * Doğrulama ATLANMAZ: protokolün kendi doğrulayıcısından geçer.
     */
    niyet(tur: string, govde: Record<string, unknown> = {}): string {
      if (!girdi.orion()) return "avatar henüz hazır değil";
      const d = niyetDogrula({ ...govde, tur });
      if (!d.ok) { console.warn(`[niyet] reddedildi: ${d.hata}`); return d.hata; }
      const id = `elle_${Date.now().toString(36)}`;
      niyetiYurut(d.deger, id);
      return id;
    },
    orionDurumu: () => girdi.orion()?.durum() ?? null,
    /** Spec 24: ovaya çık / ofise dön (kapı tetiği C3'te; bu deneme yüzeyi). */
    ovayaCik: () => gecis.ovayaCik(),
    odayaDon: () => gecis.odayaDon(),
    kapidanGec: () => gecis.kapidanGec(),
    /**
     * Spec 25 V0: Orion'un gözünden kare + o karenin geometrik gerçeği. x/z/yaw verilirse Orion önce oraya konur.
     * Ölçüm aracı `tools/goz-olc.mjs` kullanır.
     */
    async orionGozu(x?: number, z?: number, yaw?: number, en = 896, boy = 504) {
      const o = girdi.orion();
      if (!o) return null;
      if (x !== undefined && z !== undefined && yaw !== undefined) {
        o.isinla(x, z, yaw);
        await new Promise<void>((r) => { let n = 0; const g = sahne.onAfterRenderObservable.add(() => { if (++n >= 2) { sahne.onAfterRenderObservable.remove(g); r(); } }); });
      }
      return orionKaresi(en, boy, yaw);
    },
    yer: () => ({ ozyn: yerler.ozyn.ad, orion: yerler.orion.ad, kurulumMs: gecis.birlesik()?.kurulumMs ?? gecis.disari()?.kurulumMs ?? null }),
    tahta: {
      yaz: (m: string, temizle = false) => tahta.yaz(m, temizle),
      sil: () => tahta.sil(),
      satirlar: () => tahta.satirlar(),
      olcu: () => tahta.olcu(),
    },
    terminal: {
      ac: () => odak.monitoreGec(),
      kapat: () => { monitor.kapat(); rig.odakBirak(); },
      kuyruk: (n?: number) => monitor.kuyruk(n),
    },
  };
  window.dunya = dunyaKancasi;

  // ── Hızlı deneme tuşları (1-6) ────────────────────────────────────────────
  // Terminal odaktayken devre dışı: orada rakamlar kabuğa gitmeli.
  const HIZLI_NIYETLER: Record<string, [string, Record<string, unknown>]> = {
    "1": ["git",  { hedef: { tip: "capa", ad: "tahta" } }],
    "2": ["git",  { hedef: { tip: "capa", ad: "pencere" } }],
    "3": ["otur", {}],
    "4": ["kalk", {}],
    "5": ["bak",  { hedef: { tip: "oyuncu" } }],
    "6": ["jest", { jest: "el_salliyor" }],
  };
  addEventListener("keydown", (e) => {
    const d = oyuncu.oyuncuDurumu();
    if (d.etkilesim === "monitor") return;  // terminal odakta
    const n = HIZLI_NIYETLER[e.key];
    if (!n || !girdi.orion()) return;
    const sonuc = dunyaKancasi.niyet(n[0], n[1]);
    altyaziGoster(`Orion: ${n[0]} ${JSON.stringify(n[1]).slice(0, 40)}`, 1600);
    console.log(`[hizli] ${e.key} → ${n[0]} (${sonuc})`);
  });
}
