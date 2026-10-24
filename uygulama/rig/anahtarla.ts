// uygulama/rig/anahtarla.ts — RİG DÜZENLEMESİ → SEKANS ANAHTARI (spec 38 §5): "bu uzvun şu karedeki dönmesi şu olsun" → izler/anahtarlar. SAF, DEĞİŞTİRİLEMEZ.
//
// Auto-key'in çekirdeği. Ozyn bir kontrolü döndürünce hedef: uzvun O KAREDEKİ TOPLAM dönmesi (bütün izlerin toplamı: klip bölümü + uzuv izi,
// `degerlendir.ts` kuralı). Anahtara yazılan değer = hedef − (öteki izlerin katkısı): klip altta oynarken elle eklenen iz klibin ÜSTÜNE biner, klip bozulmaz.
// İz yoksa açılır (en çok 64 iz: tavan nedenle reddedilir). YENİ AÇILAN iz yalnız o kareyi değiştirsin diye komşu karelere (±KOMSU_KARE) 0 anahtar konur:
// tek anahtarlı iz bütün sekansı o değere çekerdi. Her işlem `sekansDogrula`dan geçer (kilitli iz, anahtar tavanı, aralık dışı → neden).
"use strict";
import { DONME_KANALLARI, KLIP_SINIRLARI, OTELEME_KANALLARI, otelemeMi, type Kanal, type Uzuv } from "../../protocol/animasyon.ts";
import type { Sonuc } from "../../protocol/dogrula.ts";
import type { Sekans } from "../../protocol/sekans.ts";
import { kisEuler, type Euler, type KlipBulucu, type UzuvDegeri } from "../../world/avatar/index.ts";
import { degerlendir } from "../sekans/degerlendir.ts";
import { anahtarEkle, uzuvIziEkle } from "../sekans/editor/sekansIslemleri.ts";

/** Yeni açılan izin öteki karelere sızmaması için komşu anahtar uzaklığı (kare; 6 = 0,2 sn). */
export const KOMSU_KARE = 6;
const ESIK_DERECE = 1e-3;
const kanalEkseni = (k: Kanal): "x" | "y" | "z" => k.slice(-1) as "x" | "y" | "z";

/** Bağlamanın, karedeki uzuv değerleri (avatara verilen biçim): `rigPozu` bunu her karede uygular. */
export function baglamaDegerleri(s: Sekans, baglama: string, kare: number, klipler: KlipBulucu): UzuvDegeri[] {
  return degerlendir(s, kare, klipler).degerler.filter((d) => d.baglama === baglama).map(({ uzuv, kanal, deger }) => ({ uzuv, kanal, deger }));
}

/** Uzvun karedeki TOPLAM Euler dönmesi (derece; yazılmayan kanal 0). */
export function uzuvEuleri(s: Sekans, baglama: string, uzuv: Uzuv, kare: number, klipler: KlipBulucu): Euler {
  const e: Euler = { x: 0, y: 0, z: 0 };
  for (const d of baglamaDegerleri(s, baglama, kare, klipler)) if (d.uzuv === uzuv && d.kanal.startsWith("donme_")) e[kanalEkseni(d.kanal)] = d.deger;
  return e;
}

export interface RigDuzenlemesi { sekans: Sekans; /** Yazılan anahtar sayısı (komşu sıfırlar dahil değil). */ yazilan: number; /** Yeni açılan iz kimlikleri. */ yeniIzler: string[] }

/** Uzvun karedeki TOPLAM öteleme değeri (metre; yalnız `kok` uzvunda anlamlı; yazılmayan kanal 0). */
export function uzuvOtelemesi(s: Sekans, baglama: string, uzuv: Uzuv, kare: number, klipler: KlipBulucu): { x: number; y: number; z: number } {
  const o = { x: 0, y: 0, z: 0 };
  for (const d of baglamaDegerleri(s, baglama, kare, klipler)) if (d.uzuv === uzuv && d.kanal.startsWith("oteleme_")) o[kanalEkseni(d.kanal)] = d.deger;
  return o;
}

/** `uzuv`un `kare`deki toplam dönmesini `hedef` yapar. Değişmeyen kanala dokunulmaz (iz açılmaz). */
export function rigDuzenle(s: Sekans, baglama: string, uzuv: Uzuv, kare: number, hedef: Euler, klipler: KlipBulucu): Sonuc<RigDuzenlemesi> {
  return kanallariYaz(s, baglama, uzuv, kare, DONME_KANALLARI, kisEuler(hedef, KLIP_SINIRLARI.donme), KLIP_SINIRLARI.donme, klipler);
}

/** `kok` uzvunun `kare`deki toplam ötelemesini (metre; gövde uzayı) `hedef` yapar: Taşı gizmo'su. Biçim sınırı ±0,5 m (KLIP_SINIRLARI.oteleme). */
export function rigOtelemeDuzenle(s: Sekans, baglama: string, kare: number, hedef: { x: number; y: number; z: number }, klipler: KlipBulucu): Sonuc<RigDuzenlemesi> {
  const sinir = KLIP_SINIRLARI.oteleme, k = (v: number) => Math.max(-sinir, Math.min(sinir, v));
  return kanallariYaz(s, baglama, "kok", kare, OTELEME_KANALLARI, { x: k(hedef.x), y: k(hedef.y), z: k(hedef.z) }, sinir, klipler);
}

function kanallariYaz(s: Sekans, baglama: string, uzuv: Uzuv, kare: number, kanallar: readonly Kanal[], h: { x: number; y: number; z: number }, sinirDeger: number, klipler: KlipBulucu): Sonuc<RigDuzenlemesi> {
  if (!s.baglamalar.some((b) => b.id === baglama)) return { ok: false, hata: `bağlama yok: '${baglama}'` };
  if (!Number.isInteger(kare) || kare < 0 || kare > s.sure_kare) return { ok: false, hata: `kare sekansın dışında (0–${s.sure_kare})` };
  const esik = kanallar.some(otelemeMi) ? 1e-5 : ESIK_DERECE;
  let x = s, yazilan = 0;
  const yeniIzler: string[] = [];
  for (const kanal of kanallar) {
    const ekseni = kanalEkseni(kanal);
    const iz = x.izler.find((z) => z.tur === "uzuv" && z.baglama === baglama && z.uzuv === uzuv && z.kanal === kanal);
    // Öteki izlerin katkısı: bu uzuv izini gizleyip değerlendir; toplam = öteki + bu izin değeri.
    const gizli = iz ? { ...x, izler: x.izler.map((z) => (z.id === iz.id ? { ...z, gizli: true } : z)) } : x;
    const ote = baglamaDegerleri(gizli, baglama, kare, klipler).find((d) => d.uzuv === uzuv && d.kanal === kanal)?.deger ?? 0;
    const simdi = baglamaDegerleri(x, baglama, kare, klipler).find((d) => d.uzuv === uzuv && d.kanal === kanal)?.deger ?? 0;
    if (Math.abs(h[ekseni] - simdi) < esik) continue;
    const deger = Math.max(-sinirDeger, Math.min(sinirDeger, h[ekseni] - ote));
    let izId = iz?.id;
    if (!iz) {
      const e = uzuvIziEkle(x, baglama, uzuv, kanal);
      if (!e.ok) return e;
      x = e.deger.sekans; izId = e.deger.iz; yeniIzler.push(izId);
      for (const k of [kare - KOMSU_KARE, kare + KOMSU_KARE]) {
        if (k < 0 || k > x.sure_kare) continue;
        const k0 = anahtarEkle(x, izId, k, 0);
        if (!k0.ok) return k0;
        x = k0.deger;
      }
    }
    const r = anahtarEkle(x, izId!, kare, deger);
    if (!r.ok) return r;
    x = r.deger; yazilan++;
  }
  return { ok: true, deger: { sekans: x, yazilan, yeniIzler } };
}
