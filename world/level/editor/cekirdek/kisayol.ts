// world/level/editor/cekirdek/kisayol.ts — TEK tuş haritası (spec 22). Saf.
//
// Bütün klavye kısayolları burada: editör tek bir `keydown` dinleyicisiyle `eslesen`i sorar, eylemi çalıştırır.
// Yardım kartı (F1) bu listeden üretilir; test bekçisi aynı bağlamda aynı tuş birleşiminin iki eyleme bağlanmasını
// (bugünkü Q/E çakışması gibi) yakalar.
//
// DÜZEN (neden böyle): gezinme fareye, araçlar RAKAMLARA (WASD'den uzak, uçarken basılmaz), düzenleme Ctrl'li
// standart tuşlara. Sağ tık basılıyken WASD/QE/Space/C uçuştur ve bu harita SORULMAZ (kamera denetimi tutar) —
// böylece Q/E hem uçuşta hem başka işte kullanılmaz. Fare hareketleri (FARE_HAREKETLERI) yalnız yardım içindir.
"use strict";

/** Editör kipi: fare serbest, araçlar; uçuş kipi: fare kilitli serbest uçuş (Tab ile geçilir). `her`: ikisinde de. */
export type Baglam = "editor" | "ucus" | "her";

export type Eylem =
  | "aracSec" | "aracTasi" | "aracDondur" | "aracOlcek" | "aracKutu" | "aracFirca" | "aracArazi" | "aracGunes" | "aracOlcu"
  | "geriAl" | "ileriAl" | "cogalt" | "kopyala" | "yapistir" | "kes" | "sil" | "hepsiniSec" | "secimiBirak"
  | "grupla" | "grubuCoz" | "gizle" | "hepsiniGoster" | "kilitle" | "zemineIndir" | "uzayDegistir"
  | "odakla" | "solaDondur" | "sagaDondur" | "kaydirSol" | "kaydirSag" | "kaydirIleri" | "kaydirGeri" | "kaydirYukari" | "kaydirAsagi"
  | "yerImiKaydet" | "yerImineGit" | "kaydet" | "varlikAra" | "kipDegistir" | "yardim" | "izgara" | "yaslamaAcKapa"
  | "stilSonraki" | "renkSonraki" | "sonrasiAtla" | "inspektor";

export interface Kisayol {
  eylem: Eylem;
  /** KeyboardEvent.code (klavye düzeninden bağımsız: Türkçe Q klavyede de aynı fiziksel tuş). */
  tus: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  baglam: Baglam;
  /** Yardım kartındaki başlık ve açıklama. */
  grup: string;
  aciklama: string;
  /** Metin kutusundayken de çalışır (Ctrl+S, Esc). */
  yazarkenDe?: boolean;
  /** Basılı tutulan eylem (bırakınca biter: B). */
  basili?: boolean;
  /** Rakam yuvası (yer imleri 1–9) — eyleme parametre. */
  yuva?: number;
}

const k = (eylem: Eylem, tus: string, grup: string, aciklama: string, ek: Partial<Kisayol> = {}): Kisayol =>
  ({ eylem, tus, grup, aciklama, baglam: "editor", ...ek });

const ARAC = "Araçlar", DUZEN = "Düzenleme", SAHNE = "Sahne", GORUNUM = "Görünüm";

export const KISAYOLLAR: readonly Kisayol[] = [
  k("aracSec", "Digit1", ARAC, "Seç"),
  k("aracTasi", "Digit2", ARAC, "Taşı (gizmo okları)"),
  k("aracDondur", "Digit3", ARAC, "Döndür (gizmo halkaları)"),
  k("aracOlcek", "Digit4", ARAC, "Ölçekle"),
  k("aracKutu", "Digit5", ARAC, "Sınır kutusu (köşeden ölçek/dönüş)"),
  k("aracFirca", "Digit6", ARAC, "Fırça: boya-yerleştir (Shift basılı: sil, Ctrl+tekerlek: yarıçap)"),
  k("aracArazi", "Digit7", ARAC, "Arazi fırçası"),
  k("aracGunes", "Digit8", ARAC, "Güneş: gökyüzüne sürükle (zaman tanımlıysa yatay sürükleme saati değiştirir)"),
  k("aracOlcu", "Digit9", ARAC, "Ölç: iki noktaya tıkla, aradaki mesafe"),
  k("uzayDegistir", "KeyX", ARAC, "Gizmo: yerel ⇄ dünya ekseni"),
  k("yaslamaAcKapa", "KeyN", ARAC, "Izgaraya yaslama aç/kapa (Ctrl basılı = geçici tersle)"),

  k("geriAl", "KeyZ", DUZEN, "Geri al", { ctrl: true }),
  k("ileriAl", "KeyY", DUZEN, "İleri al", { ctrl: true }),
  k("ileriAl", "KeyZ", DUZEN, "İleri al", { ctrl: true, shift: true }),
  k("cogalt", "KeyD", DUZEN, "Çoğalt (yerinde, ızgara adımı öteye)", { ctrl: true }),
  k("kopyala", "KeyC", DUZEN, "Kopyala", { ctrl: true }),
  k("kes", "KeyX", DUZEN, "Kes", { ctrl: true }),
  k("yapistir", "KeyV", DUZEN, "Yapıştır (imlecin altına)", { ctrl: true }),
  k("sil", "Delete", DUZEN, "Sil"),
  k("sil", "Backspace", DUZEN, "Sil"),
  k("hepsiniSec", "KeyA", DUZEN, "Hepsini seç", { ctrl: true }),
  k("secimiBirak", "Escape", DUZEN, "Süren işlemi iptal et; yoksa seçimi bırak", { yazarkenDe: true }),
  k("grupla", "KeyG", DUZEN, "Grupla", { ctrl: true }),
  k("grubuCoz", "KeyG", DUZEN, "Grubu çöz", { ctrl: true, shift: true }),
  k("gizle", "KeyH", DUZEN, "Seçiliyi gizle"),
  k("hepsiniGoster", "KeyH", DUZEN, "Hepsini göster", { alt: true }),
  k("kilitle", "KeyL", DUZEN, "Kilitle / kilidi aç"),
  k("zemineIndir", "End", DUZEN, "Zemine / alttaki yüzeye indir"),
  k("solaDondur", "BracketLeft", DUZEN, "Y'de −15° döndür (Shift: −90°)"),
  k("sagaDondur", "BracketRight", DUZEN, "Y'de +15° döndür (Shift: +90°)"),
  k("solaDondur", "BracketLeft", DUZEN, "Y'de −90° döndür", { shift: true }),
  k("sagaDondur", "BracketRight", DUZEN, "Y'de +90° döndür", { shift: true }),
  k("kaydirSol", "ArrowLeft", DUZEN, "Kameraya göre sola kaydır (ızgara adımı)"),
  k("kaydirSag", "ArrowRight", DUZEN, "Sağa kaydır"),
  k("kaydirIleri", "ArrowUp", DUZEN, "İleri kaydır"),
  k("kaydirGeri", "ArrowDown", DUZEN, "Geri kaydır"),
  k("kaydirYukari", "PageUp", DUZEN, "Yukarı kaydır (Y adımı)"),
  k("kaydirAsagi", "PageDown", DUZEN, "Aşağı kaydır"),

  k("odakla", "KeyF", SAHNE, "Seçime odaklan (seçim yoksa her şeye)"),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((r) => [
    k("yerImineGit", `Digit${r}`, SAHNE, `Kamera yer imi ${r}'e git`, { shift: true, yuva: r }),
    k("yerImiKaydet", `Digit${r}`, SAHNE, `Kamera yer imi ${r}'i kaydet`, { ctrl: true, shift: true, yuva: r }),
  ]),
  k("kaydet", "KeyS", SAHNE, "Level'i kaydet", { ctrl: true, baglam: "her", yazarkenDe: true }),
  k("varlikAra", "KeyF", SAHNE, "Varlık aramasına git", { ctrl: true }),
  k("izgara", "KeyI", SAHNE, "Zemin ızgarasını göster/gizle"),

  k("kipDegistir", "Tab", GORUNUM, "Editör ⇄ uçuş kipi", { baglam: "her" }),
  k("yardim", "F1", GORUNUM, "Kısayol kartı", { baglam: "her" }),
  k("yardim", "Slash", GORUNUM, "Kısayol kartı", { shift: true, baglam: "her" }),
  k("stilSonraki", "KeyP", GORUNUM, "Sonraki stil önayarı", { baglam: "her" }),
  k("renkSonraki", "KeyP", GORUNUM, "Sonraki renk şeması", { shift: true, baglam: "her" }),
  k("sonrasiAtla", "KeyB", GORUNUM, "Basılıyken ışık sonrası kapalı (önce/sonra)", { baglam: "her", basili: true }),
  k("inspektor", "F8", GORUNUM, "Babylon Inspector", { baglam: "her" }),
];

/** Yardım kartı için fare hareketleri (harita değil, açıklama). */
export const FARE_HAREKETLERI: readonly { hareket: string; aciklama: string }[] = [
  { hareket: "Sağ tık basılı + fare", aciklama: "Etrafa bak; basılıyken W A S D uç, Space/E yukarı, Q/C aşağı, tekerlek uçuş hızı" },
  { hareket: "Orta tık sürükle", aciklama: "Kaydır (pan)" },
  { hareket: "Tekerlek", aciklama: "İmlecin altındaki noktaya yaklaş / uzaklaş" },
  { hareket: "Alt + sol sürükle", aciklama: "Seçimin (yoksa imlecin altındaki noktanın) çevresinde dön" },
  { hareket: "Sol tık", aciklama: "Seç (Shift: ekle, Ctrl: çıkar/ekle); boşlukta sürükle: kutu seçimi (Shift: ekleyerek)" },
  { hareket: "Seçiliyi sol tıkla sürükle", aciklama: "Yüzeyde kaydır (zemin + nesnelerin üstü); tutarken tekerlek döndürür" },
  { hareket: "Shift + seçiliyi sürükle", aciklama: "Çoğaltıp kaydır (gizmo okunda da); kopya yerinde kalır, tuttuğun gider" },
  { hareket: "Çift tık", aciklama: "Nesneye odaklan" },
  { hareket: "Varlık kartını sahneye sürükle", aciklama: "Bırakılan yere yerleştir (ya da karta tıkla, sahnede tıkla)" },
];

export interface TusOlayi { code: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }

const ayni = (a: Kisayol, o: TusOlayi) =>
  a.tus === o.code && !!a.ctrl === (o.ctrlKey || o.metaKey) && !!a.shift === o.shiftKey && !!a.alt === o.altKey;

/** Olayla eşleşen kısayol (yoksa null). `yaziyor`: odak metin kutusunda — yalnız `yazarkenDe` olanlar. */
export function eslesen(liste: readonly Kisayol[], o: TusOlayi, baglam: Exclude<Baglam, "her">, yaziyor: boolean): Kisayol | null {
  return liste.find((a) => (a.baglam === "her" || a.baglam === baglam) && (!yaziyor || a.yazarkenDe) && ayni(a, o)) ?? null;
}

/** "Ctrl+Shift+Z" biçimi (yardım kartı, düğme ipuçları). */
export function tusMetni(a: Pick<Kisayol, "tus" | "ctrl" | "shift" | "alt">): string {
  const ad = a.tus.replace(/^Key/, "").replace(/^Digit/, "").replace(/^Arrow/, "Ok ")
    .replace("BracketLeft", "[").replace("BracketRight", "]").replace("Slash", "/").replace("Escape", "Esc");
  return [a.ctrl ? "Ctrl" : "", a.shift ? "Shift" : "", a.alt ? "Alt" : "", ad].filter(Boolean).join("+");
}

/** Aynı bağlamda aynı birleşime bağlı FARKLI eylemler (bekçi: boş olmalı). */
export function cakismalar(liste: readonly Kisayol[]): string[] {
  const sonuc: string[] = [];
  for (let i = 0; i < liste.length; i++) for (let j = i + 1; j < liste.length; j++) {
    const a = liste[i]!, b = liste[j]!;
    const baglamOrtak = a.baglam === "her" || b.baglam === "her" || a.baglam === b.baglam;
    if (baglamOrtak && tusMetni(a) === tusMetni(b) && (a.eylem !== b.eylem || a.yuva !== b.yuva)) sonuc.push(`${tusMetni(a)}: ${a.eylem} / ${b.eylem}`);
  }
  return sonuc;
}

/** Bir eylemin ilk kısayol metni (düğme ipucu: "Taşı (2)"). */
export const eylemTusu = (e: Eylem): string => { const a = KISAYOLLAR.find((x) => x.eylem === e); return a ? tusMetni(a) : ""; };
