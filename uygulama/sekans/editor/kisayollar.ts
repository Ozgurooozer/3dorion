// uygulama/sekans/editor/kisayollar.ts — SEKANS EDİTÖRÜNÜN KISAYOLLARI (spec 36 S2): tuş → komut ve yardım listesi. SAF (DOM'suz test edilir).
//
// TEK KAYNAK: editörün tuş işleyicisi, "?" yardım kutusu ve spec 36'daki tablo bu listeden. Kurallar graf editörününkiyle aynı (`uygulama/graf/editor/
// kisayollar.ts`): yazı alanında tuş HARFTİR (yalnız Ctrl+S ve Esc editörün); harfler `code` ile (Türkçe klavyede de aynı fiziksel tuş).
// ▶ OYNAT'IN KISAYOLU YOK (bilinçli): oynatmak yalnız ▶ düğmesine gerçek tık (güvenlik bekçisi düğmenin işleyicisini sınar); Boşluk bu yüzden ▶ değil.
// Editör açıkken oyun tuşları (WASD, 1–4, Y, T, Tab…) OYUNA GİTMEZ — o kural editörün kökünde (uygulama/yapi/sekans/sekansEditoru.ts).
"use strict";

export type SekansKomutu =
  | "kaydet" | "geriAl" | "yinele" | "sil" | "anahtarEkle" | "geri1" | "ileri1" | "geri10" | "ileri10" | "basa" | "sona"
  | "oncekiAnahtar" | "sonrakiAnahtar" | "sigdir" | "yasla" | "tumunuSec" | "yardim" | "kapat" | "alandanCik";

export interface SekansKisayolu { tus: string; komut?: SekansKomutu; aciklama: string }

export const SEKANS_KISAYOLLARI: readonly SekansKisayolu[] = [
  { tus: "Cetvele tık / sürükle", aciklama: "playhead'i o kareye götür (scrub); sekans oynamıyorsa beden kıpırdamaz" },
  { tus: "← / →  (Shift: 10)", komut: "geri1", aciklama: "playhead bir kare geri / ileri (Shift ile 10 kare)" },
  { tus: "Home / End", komut: "basa", aciklama: "oynatma aralığının başına / sonuna" },
  { tus: ", / .", komut: "oncekiAnahtar", aciklama: "seçili izde önceki / sonraki anahtara atla" },
  { tus: "K", komut: "anahtarEkle", aciklama: "seçili uzuv izine playhead'de anahtar ekle (değer: o karedeki değer)" },
  { tus: "Anahtara tık / Shift+tık / boşlukta sürükle", aciklama: "seç / seçime ekle / kutu seçimi" },
  { tus: "Anahtarı sürükle (Shift: tek eksen)", aciklama: "yatay = zaman, dikey = değer (1 px = 1° ya da 0,005 m); Shift baskın eksende tutar" },
  { tus: "Bölümü sürükle · kenarları", aciklama: "taşı · sağ kenar uzat/kısalt · sol kenar kırp (klibin başını keser)" },
  { tus: "N", komut: "yasla", aciklama: "yaslamayı aç/kapa (komşu anahtar, bölüm kenarı, playhead)" },
  { tus: "Delete", komut: "sil", aciklama: "seçili anahtarları / bölümü sil" },
  { tus: "Ctrl+S", komut: "kaydet", aciklama: "kaydet (biçim doğrulanır; bozuksa yazılmaz)" },
  { tus: "Ctrl+Z / Ctrl+Y", komut: "geriAl", aciklama: "geri al / yinele (sürükleme tek adım)" },
  { tus: "Ctrl+A", komut: "tumunuSec", aciklama: "seçili izin (yoksa hepsinin) bütün anahtarları" },
  { tus: "Tekerlek · Ctrl+tekerlek · orta tuş", aciklama: "zaman ekseninde yakınlaş (imlecin altındaki kare yerinde kalır) · satırları kaydır · sürükleyerek kaydır" },
  { tus: "F", komut: "sigdir", aciklama: "oynatma aralığını ekrana sığdır" },
  { tus: "? / F1", komut: "yardim", aciklama: "bu liste" },
  { tus: "Esc", komut: "kapat", aciklama: "sürüklemeyi/yardımı kapat; yoksa editörü gizle (kaydedilmemişse önce uyarır)" },
];

export interface TusOlayi { key: string; code: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean; repeat?: boolean }

export function sekansKomutu(e: TusOlayi, yaziAlaninda: boolean): SekansKomutu | null {
  const ctrl = !!(e.ctrlKey || e.metaKey);
  if (ctrl && !e.altKey && e.code === "KeyS") return "kaydet";
  if (e.key === "Escape") return yaziAlaninda ? "alandanCik" : "kapat";
  if (yaziAlaninda || e.altKey) return null;
  if (ctrl) {
    if (e.code === "KeyZ") return e.shiftKey ? "yinele" : "geriAl";
    if (e.code === "KeyY") return "yinele";
    if (e.code === "KeyA") return "tumunuSec";
    return null;
  }
  // Kare adımı basılı tutunca TEKRARLAR (playhead kayar); öteki tuşlar tekrar etmez.
  if (e.key === "ArrowLeft") return e.shiftKey ? "geri10" : "geri1";
  if (e.key === "ArrowRight") return e.shiftKey ? "ileri10" : "ileri1";
  if (e.repeat) return null;
  if (e.key === "Home") return "basa";
  if (e.key === "End") return "sona";
  if (e.key === ",") return "oncekiAnahtar";
  if (e.key === ".") return "sonrakiAnahtar";
  if (e.key === "Delete" || e.key === "Backspace") return "sil";
  if (e.code === "KeyK") return "anahtarEkle";
  if (e.code === "KeyN") return "yasla";
  if (e.code === "KeyF") return "sigdir";
  if (e.key === "?" || e.key === "F1") return "yardim";
  return null;
}
