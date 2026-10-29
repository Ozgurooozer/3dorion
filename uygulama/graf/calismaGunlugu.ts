// uygulama/graf/calismaGunlugu.ts — ÇALIŞMA GÜNLÜĞÜ (spec 43 A4; Unreal "Print/Watch"un karşılığı). SAF: DOM ve Babylon yok.
//
// Bir grafın çalışması boyunca her düğümün BİTİNCE giriş/çıkış değerlerini (kısaltılmış) tutan halka tampon: "hangi düğüm ne aldı, ne verdi, ne kadar sürdü, nerede düştü".
// Yorumlayıcı (`yorumlayici.ts`) `dugumBitti` olayını verir, `calismaBaslat` satıra çevirip buraya ekler; editörde "Günlük" bölümü bunu çizer.
// Tavanlı: son `GUNLUK_SATIR_AZAMI` (200) satır; her değer `ONIZLEME_AZAMI` (120) karaktere kısalır (günlük bellekte büyümez, ekrana taşmaz).
// Yalnız BELLEKTE (uygulama kapanınca gider); diske yazılmaz.
"use strict";

export const GUNLUK_SATIR_AZAMI = 200;
export const ONIZLEME_AZAMI = 120;

/** Bir değerin günlük için tek satırlık, ≤ 120 karakterlik gösterimi. Metin tırnaklı (boşluk/boş metin görünsün), nesne JSON, yok → "yok". */
export function onizle(v: unknown): string {
  let s: string;
  if (v === undefined) s = "yok";
  else if (typeof v === "string") s = JSON.stringify(v);
  else if (typeof v === "number" || typeof v === "boolean" || v === null) s = String(v);
  else { try { s = JSON.stringify(v) ?? String(v); } catch { s = String(v); } }
  return s.length > ONIZLEME_AZAMI ? `${s.slice(0, ONIZLEME_AZAMI - 1)}…` : s;
}

/** `{ pin: değer }` → `{ pin: önizleme }` (günlük satırı için). */
export function onizleHaritasi(v: Readonly<Record<string, unknown>> | undefined): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [k, d] of Object.entries(v ?? {})) r[k] = onizle(d);
  return r;
}

export interface GunlukSatiri {
  /** Günlük içinde artan sıra (temizlense de sıfırlanmaz; dinleyici yeni satırı ayırt eder). */
  sira: number;
  /** Çalışmayı kim başlattı: "▶ <graf>" ya da "aktör <kimlik>". */
  kaynak: string;
  graf: string;
  /** Düğüm kimliği; çalışma düğümsüz düştüyse (çalıştırılamaz) "-". */
  id: string;
  tip: string;
  ad: string;
  derinlik: number;
  girdi: Readonly<Record<string, string>>;
  cikti: Readonly<Record<string, string>>;
  /** Akışta sonraki çıkış pini (varsa). */
  sonra: string | null;
  ms: number;
  /** Düğüm düştüyse nedeni (girdi/çıktı boş). */
  hata?: string;
}

export interface CalismaGunlugu {
  ekle(s: Omit<GunlukSatiri, "sira">): void;
  satirlar(): readonly GunlukSatiri[];
  temizle(): void;
  dinle(f: () => void): () => void;
}

export function calismaGunluguKur(azami: number = GUNLUK_SATIR_AZAMI): CalismaGunlugu {
  let liste: GunlukSatiri[] = [];
  let sira = 0;
  const dinleyiciler = new Set<() => void>();
  const yay = (): void => { for (const f of [...dinleyiciler]) { try { f(); } catch (err) { console.error("[graf] günlük dinleyicisi hatası:", err); } } };
  return {
    ekle(s) {
      liste.push({ ...s, sira: ++sira });
      if (liste.length > azami) liste = liste.slice(liste.length - azami);
      yay();
    },
    satirlar: () => liste,
    temizle() { liste = []; yay(); },
    dinle(f) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; },
  };
}

/** Günlük satırının tek satırlık metni: `w1 (Aktör alanı yaz)  deger=0.2  → sonra · 3 ms` ya da `✗ hata`. */
export function gunlukMetni(s: GunlukSatiri): string {
  const harita = (h: Readonly<Record<string, string>>): string => Object.entries(h).map(([k, v]) => `${k}=${v}`).join(" ");
  const derin = s.derinlik > 0 ? ` [desen ${s.graf}]` : "";
  if (s.hata !== undefined) return `✗ ${s.id === "-" ? "" : `${s.id} (${s.ad})${derin}: `}${s.hata}`;
  const girdi = harita(s.girdi), cikti = harita(s.cikti);
  return `${s.id} (${s.ad})${derin}${girdi ? `  ${girdi}` : ""}${cikti ? `  → ${cikti}` : ""}${s.sonra ? `  ▸ ${s.sonra}` : ""} · ${s.ms} ms`;
}
