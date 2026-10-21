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
  /** Oyun tuşları serbest mi (sohbet kapalı, onay beklemiyor, terminal odakta değil)? Verilmezse yalnız terminal odağı denetlenir (eski davranış). */
  tusSerbest?: () => boolean;
}

/** Hızlı deneme tuşlarının (1-6) niyetleri: tuş → [tür, argüman]. */
export const HIZLI_NIYETLER: Readonly<Record<string, readonly [string, Readonly<Record<string, unknown>>]>> = {
  "1": ["git",  { hedef: { tip: "capa", ad: "tahta" } }],
  "2": ["git",  { hedef: { tip: "capa", ad: "pencere" } }],
  "3": ["otur", {}],
  "4": ["kalk", {}],
  "5": ["bak",  { hedef: { tip: "oyuncu" } }],
  "6": ["jest", { jest: "el_salliyor" }],
};

/** Olayın hedefi bir yazı alanı mı (input, textarea, select, contentEditable): orada tuş HARFTİR. Yapısal yoklama: DOM'suz testte de çalışır. */
export function yaziHedefiMi(h: EventTarget | null): boolean {
  const e = h as { tagName?: string; isContentEditable?: boolean } | null;
  return !!e && (e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.tagName === "SELECT" || e.isContentEditable === true);
}

/**
 * Hızlı deneme tuşunun niyeti; tuş oyuna AİT DEĞİLSE null. Kapı (Ozyn, 2026-10-21: "1 2 3 4 tuşları oyuna sızıyor sohbet ederken"):
 * eskiden yalnız terminal odağı kontrol ediliyordu, yani sohbet kutusuna "1" yazınca Orion tahtaya yürüyordu. Şimdi: serbest değilse (sohbet açık,
 * onay bekliyor, terminal odakta), hedef yazı alanıysa, Ctrl/Alt/Meta ile basıldıysa ya da IME yazımı sürüyorsa tuş oyuna gitmez.
 */
export function hizliTusNiyeti(
  e: { key: string; target: EventTarget | null; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; isComposing?: boolean },
  tusSerbest: boolean,
): readonly [string, Readonly<Record<string, unknown>>] | null {
  if (!tusSerbest || yaziHedefiMi(e.target) || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return null;
  return HIZLI_NIYETLER[e.key] ?? null;
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
  addEventListener("keydown", (e) => {
    const d = oyuncu.oyuncuDurumu();
    const n = hizliTusNiyeti(e, d.etkilesim !== "monitor" && (girdi.tusSerbest?.() ?? true));   // terminal odakta, sohbet açık ya da yazı alanında: tuş harftir
    if (!n || !girdi.orion()) return;
    const sonuc = dunyaKancasi.niyet(n[0], n[1]);
    altyaziGoster(`Orion: ${n[0]} ${JSON.stringify(n[1]).slice(0, 40)}`, 1600);
    console.log(`[hizli] ${e.key} → ${n[0]} (${sonuc})`);
  });
}
