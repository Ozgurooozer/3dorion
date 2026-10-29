// uygulama/yapi/ortak/dok/dokPencere.ts — YÜZER PENCERELERİ DOK'A ALMA (spec 41 D2): Gözlem (O), Beden (B), nesne paneli, model seçici (M), stil penceresi (G).
//
// Bu pencereler kendi DOM'larını kurar ve açılıp kapanmalarını bir işaretle belirtir (`data-acik="1"` ya da `acik` sınıfı). Burası üç şey yapar:
//   1. Pencerenin KÖKÜNÜ dok kabına taşır (`dk-gomulu`: konum ve boyut kabın, yüzen konum ve z-index yok).
//   2. Açık/kapalı durumunu dok görünürlüğüne bağlar: açılınca bölgede sekme olur ve etkin olur, kapanınca sekme kalkar.
//   3. Pencerenin kendi açma/kapama, klavye ve kayıt mantığına DOKUNMAZ.
// Sekme adı ve simgesi dok'un kendisinden gelir; kullanıcı pencereyi sürükleyip sol/sağ/alt/yüzer bölgeye bırakabilir.
"use strict";
import type { DokYoneticisi } from "./dokYoneticisi.ts";
import type { Bolge } from "./dokDuzeni.ts";

export interface DokPencereAyari {
  id: string;
  ad: string;
  simge: string;
  ipucu: string;
  /** Pencerenin kendi kökü (ör. `#gozPaneli`). Taşınır: çağıran artık bu öğeye yalnız kimliğiyle ulaşır. */
  koku: HTMLElement;
  bolgeler: readonly Bolge[];
  varsayilan: Bolge;
  /** Pencerenin kendi açılışı (Pencere menüsünden kapalıyken açmak için). Yoksa menü satırı pasif. */
  ac?(): void;
  /** Pencerenin kendi kapanışı (dok ✕ ya da menüden kapatınca). */
  kapat?(): void;
}

/** Açık mı: pencere `data-acik="1"` ya da `acik` sınıfıyla belirtir (iki bileşen iki yöntem kullanıyor). */
const acikMi = (k: HTMLElement): boolean => k.dataset.acik === "1" || k.classList.contains("acik");

export function dokPenceresiKaydet(dok: DokYoneticisi, a: DokPencereAyari): void {
  a.koku.classList.add("dk-gomulu");
  const kabi = document.createElement("div");
  kabi.append(a.koku);
  dok.kaydet({
    kayit: { id: a.id, ad: a.ad, bolgeler: [...a.bolgeler], varsayilan: a.varsayilan },
    icerik: kabi, simge: a.simge, ipucu: a.ipucu, gorunur: false,
    ac: a.ac, kapat: a.kapat,
  });
  // Pencere kendi açılışını ve kapanışını işaretine yazar; dok o işareti izleyip sekmeyi buna göre açar/kapatır.
  const izle = (): void => { const acik = acikMi(a.koku); dok.gorunur(a.id, acik); if (acik) dok.sec(a.id); };
  new MutationObserver(izle).observe(a.koku, { attributes: true, attributeFilter: ["data-acik", "class"] });
}
