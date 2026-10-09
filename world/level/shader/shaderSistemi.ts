// world/level/shader/shaderSistemi.ts — `tanim.shaderlar` listesini kurar ve canlı tutar (spec 20).
//
// Katman yöneticisinin (cekirdek/levelKur.ts) küçük kardeşi: her girdi bir modül örneği. Aynı türde kalan girdinin
// ayarı değişirse örnek YENİDEN KURULMAZ (`ayarla`) — kaydırıcı akıcı. Tür ya da açık/kapalı değişirse kurulur.
// Ekran shader'ları stil zincirinin sonuna eklenir (stil/stilSistemi.ts `ekranKur`); hangi ekran shader'larının açık
// olduğu `ekranImzasi`nda — değişince stil zinciri sırayı korumak için hepsini yeniden kurar.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import { ayarBirlestir, type Ayar } from "../cekirdek/modul.ts";
import type { Renk } from "../cekirdek/renk.ts";
import type { ShaderModulu, ShaderOrnegi, EkranEfekti } from "./modul.ts";
import { dunyaUniformlariYap, type DunyaUniformlari } from "./dunyaEklentisi.ts";
import type { DunyaDurumu } from "./dunyaDurumu.ts";

/** Tanımdaki bir shader girdisi (katman tanımıyla aynı biçim). */
export interface ShaderTanimi { tur: string; acik: boolean; ayar: Record<string, unknown> }
export type ShaderKaydi = ReadonlyMap<string, ShaderModulu>;

interface Kurulu { tur: string; ornek: ShaderOrnegi; ekranMi: boolean }

export interface ShaderSistemi {
  readonly uniform: DunyaUniformlari;
  uygula(liste: readonly ShaderTanimi[], renk: (ad: string) => Renk): void;
  kare(d: DunyaDurumu): void;
  /** Açık ekran shader'larının listesi (değişince stil zinciri yeniden kurulur). */
  ekranImzasi(): string;
  /** Ekran shader'larını SIRAYLA kameraya kurar (stil zinciri çağırır). */
  ekranKur(kamera: Camera): EkranEfekti[];
  yokEt(): void;
}

/** Tanımdaki girdileri şemayla tamamlar; bilinmeyen tür/ayar hata (katman `normallestir` deseni). */
export function shaderlariNormallestir(liste: readonly ShaderTanimi[], kayit: ShaderKaydi): ShaderTanimi[] {
  return liste.map((s) => {
    const m = kayit.get(s.tur);
    if (!m) throw new Error(`shader "${s.tur}": bilinmeyen (bilinenler: ${[...kayit.keys()].join(", ")})`);
    return { ...s, ayar: { ...ayarBirlestir(s.tur, m.varsayilan, s.ayar) } };
  });
}

export function shaderSistemiKur(sahne: Scene, kayit: ShaderKaydi): ShaderSistemi {
  const uniform = dunyaUniformlariYap();
  let kurulu: (Kurulu | null)[] = [];
  let renkCoz: (ad: string) => Renk = () => [1, 1, 1];

  const yik = (k: Kurulu | null) => k?.ornek.yokEt();

  return {
    uniform,
    uygula(liste, renk) {
      renkCoz = renk;
      const yeni: (Kurulu | null)[] = [];
      liste.forEach((s, i) => {
        const eski = kurulu[i] ?? null;
        const m = kayit.get(s.tur);
        if (!s.acik || !m) { yik(eski); yeni.push(null); return; }
        const a = ayarBirlestir(s.tur, m.varsayilan, s.ayar) as Ayar;
        if (eski && eski.tur === s.tur) { eski.ornek.ayarla(a); yeni.push(eski); return; }
        yik(eski);
        yeni.push({ tur: s.tur, ekranMi: m.ekranMi, ornek: m.kur({ sahne, uniform, renk: (ad) => renkCoz(ad) }, a) });
      });
      for (let i = liste.length; i < kurulu.length; i++) yik(kurulu[i] ?? null);
      kurulu = yeni;
    },
    kare(d) {
      uniform.sure = d.sure;
      for (const k of kurulu) k?.ornek.kare(d);
    },
    ekranImzasi: () => JSON.stringify(kurulu.map((k) => (k?.ekranMi ? k.tur : null))),
    ekranKur(kamera) {
      const efektler: EkranEfekti[] = [];
      for (const k of kurulu) { const e = k?.ekranMi ? k.ornek.ekran?.(kamera) : undefined; if (e) efektler.push(e); }
      return efektler;
    },
    yokEt() { for (const k of kurulu) yik(k); kurulu = []; },
  };
}
