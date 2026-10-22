// uygulama/graf/editor/kisayollar.ts — GÖRSEL EDİTÖRÜN KISAYOLLARI (spec 35 dilim 2b): tuş → komut, ve yardım listesi. SAF (DOM'suz test edilir).
//
// TEK KAYNAK: editörün tuş işleyicisi, "?" yardım kutusu ve spec 35'teki kısayol tablosu bu listeden. Kurallar:
//   • Yazı alanındayken (ayar kutusu, palette araması) tuş HARFTİR: yalnız Ctrl+S (kaydet) ve Esc (alandan çık) editörün; Ctrl+Z alanın kendi geri alıdır.
//   • Harfler `code` ile (KeyF): Türkçe Q/F klavyede de aynı fiziksel tuş; "?" `key` ile (klavyeye göre yeri değişir), F1 de yardım.
//   • Bu komutlar editörün; oyun tuşları (WASD, 1–4, Y, T, Tab…) editör açıkken OYUNA GİTMEZ — o kural editörün kökünde (uygulama/yapi/graf/).
"use strict";

export type EditorKomutu =
  | "kaydet" | "geriAl" | "yinele" | "sil" | "kopyala" | "kes" | "yapistir" | "cogalt" | "tumunuSec"
  | "sigdir" | "palet" | "yardim" | "kapat" | "alandanCik";

/** Kısayol satırı; `komut` yalnız klavye kısayolunda (fare eylemleri yalnız yardım metnidir). */
export interface Kisayol { tus: string; komut?: EditorKomutu; aciklama: string }

/** Yardım kutusunda ve spec'te görünen liste (sıra: en çok kullanılan önce). */
export const KISAYOLLAR: readonly Kisayol[] = [
  { tus: "Sağ tık / Boşluk", komut: "palet", aciklama: "düğüm paleti (ara, Enter ekler; düğüm imlecin yerine gelir)" },
  { tus: "Pinden sürükle", aciklama: "bağ çek; boşluğa bırakınca YALNIZ o pine uyan düğümler listelenir" },
  { tus: "Ctrl+S", komut: "kaydet", aciklama: "kaydet (biçim doğrulanır; bozuksa yazılmaz)" },
  { tus: "Ctrl+Z", komut: "geriAl", aciklama: "geri al" },
  { tus: "Ctrl+Y / Ctrl+Shift+Z", komut: "yinele", aciklama: "yinele" },
  { tus: "Delete", komut: "sil", aciklama: "seçili düğümleri bağlarıyla sil" },
  { tus: "Ctrl+C / Ctrl+X / Ctrl+V", komut: "kopyala", aciklama: "kopyala / kes / yapıştır (yeni kimliklerle, imlecin yerine)" },
  { tus: "Ctrl+D", komut: "cogalt", aciklama: "seçimi çoğalt" },
  { tus: "Ctrl+A", komut: "tumunuSec", aciklama: "hepsini seç" },
  { tus: "F", komut: "sigdir", aciklama: "grafiği ekrana sığdır (seçim varsa seçimi)" },
  { tus: "Tekerlek", aciklama: "imlecin olduğu yere yakınlaş / uzaklaş" },
  { tus: "Arka planı sürükle / orta tuş", aciklama: "tuvali kaydır" },
  { tus: "Shift+tık / kutu", aciklama: "çoklu seçim (boşlukta sürükle: kutu seçimi)" },
  { tus: "Bağa tık / sağ tık", aciklama: "bağı kaldır" },
  { tus: "? / F1", komut: "yardim", aciklama: "bu liste" },
  { tus: "Esc", komut: "kapat", aciklama: "paleti/yardımı kapat; yoksa editörü gizle (kaydedilmemişse önce uyarır; değişiklik bellekte kalır)" },
];

export interface TusOlayi { key: string; code: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean; repeat?: boolean }

/** Tuşun editör komutu; editörün değilse null. `yaziAlaninda`: olayın hedefi bir yazı alanı. */
export function editorKomutu(e: TusOlayi, yaziAlaninda: boolean): EditorKomutu | null {
  const ctrl = !!(e.ctrlKey || e.metaKey);
  if (ctrl && !e.altKey && e.code === "KeyS") return "kaydet";
  if (e.key === "Escape") return yaziAlaninda ? "alandanCik" : "kapat";
  if (yaziAlaninda || e.altKey) return null;
  if (ctrl) {
    if (e.code === "KeyZ") return e.shiftKey ? "yinele" : "geriAl";
    if (e.code === "KeyY") return "yinele";
    if (e.code === "KeyC") return "kopyala";
    if (e.code === "KeyX") return "kes";
    if (e.code === "KeyV") return "yapistir";
    if (e.code === "KeyD") return "cogalt";
    if (e.code === "KeyA") return "tumunuSec";
    return null;
  }
  if (e.repeat) return null;
  if (e.key === "Delete" || e.key === "Backspace") return "sil";
  if (e.code === "KeyF" && !e.shiftKey) return "sigdir";
  if (e.code === "Space") return "palet";
  if (e.key === "?" || e.key === "F1") return "yardim";
  return null;
}
