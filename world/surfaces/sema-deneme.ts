// world/surfaces/sema-deneme.ts — ZİHİN AKIŞI panelini SAHNESİZ çizer.
//
// Neden: panelin tasarımını görmek için Electron'u açıp odada duvara yürümek
// gerekiyordu. Çizim artık Babylon'suz (`semaCizim.ts`); bu sayfa üç
// görünümü (şema, DÜŞÜNCE detayı, teyit) gerçek boyutta (910×512, odadaki
// dokuyla aynı) yan yana çizer ve sahte bir canlı akış oynatır.
//
//   npm run dev → http://localhost:5173/world/surfaces/sema-deneme.html
//   ?donuk=1  : akışı durdur (ekran görüntüsü kararlı olsun)
"use strict";
import { semaDurumuKur } from "./semaCekirdek.ts";
import { cizSema, cizDetay, cizTeyit } from "./semaCizim.ts";
import { cizHafizaBulutu, type BulutKelimesi } from "./hafizaBulutu.ts";
import type { Pano, ModulGoruntu, Teyit } from "../../protocol/pano.ts";

const G = 910, Y = 512;
const donuk = new URLSearchParams(location.search).has("donuk");
const durum = semaDurumuKur();

// Gerçekçi bir an: birkaç tur geçmiş, düşünce yerel bir modelde.
const tohum: [string, number, string?][] = [
  ["algi", 42, "terminal: npm test"], ["suzgec", 42, "0 ms"], ["refleks", 17, "kod_rutin"],
  ["dikkat", 25, "3/20 dk"], ["hafiza", 8, "2 anı"], ["beyin", 8, "qwen2.5:7b · 1,9 sn"],
  ["niyet", 11, "soyle"], ["beden", 9, "bak"], ["onay", 1, "bekliyor (okur)"], ["bakis", 2, "monitor"],
];
{
  // Tohum vuruşları GEÇMİŞTE: yoksa ilk karede her kutu birden parlar.
  const gercek = Date.now;
  Date.now = () => gercek() - 8000;
  for (const [ad, n, not] of tohum) {
    for (let i = 0; i < n; i++) durum.vur(ad, not);
  }
  Date.now = gercek;
}
durum.lobYaz("beyin", "yerel");
durum.ariza("bakis", false);

const SECENEKLER = ["claude:haiku", "opencode", "mcp", "dis",
  "yerel:qwen2.5:7b", "yerel:qwen3:4b", "yerel:llama3.2:3b", "yerel:gemma3:4b", "yerel:mistral:7b"];
const BEYIN_MODUL: ModulGoruntu = {
  ad: "beyin", etiket: "DÜŞÜNCE", dugum: "beyin",
  dugmeler: [
    { ad: "beyin.model", etiket: "seçili beyin", sinif: "tehlikeli", etki: "sonraki_tur", birim: "",
      kaynak: "", aciklama: "", deger: "yerel:qwen2.5:7b", hata: "", yazilabilir: false,
      kilitSebebi: "teyit gerekir", adim: 0, secenekler: SECENEKLER },
    { ad: "beyin.aktif", etiket: "gerçekten koşan", sinif: "sabit", etki: "aninda", birim: "",
      kaynak: "", aciklama: "", deger: "qwen2.5:7b", hata: "", yazilabilir: false,
      kilitSebebi: "sabit", adim: 0, secenekler: [] },
    { ad: "beyin.kesik", etiket: "devre kesici", sinif: "sabit", etki: "aninda", birim: "sn",
      kaynak: "", aciklama: "", deger: 0, hata: "", yazilabilir: false,
      kilitSebebi: "sabit", adim: 0, secenekler: [] },
    { ad: "beyin.yakinlik", etiket: "yakınlık kuralı", sinif: "sabit", etki: "aninda", birim: "",
      kaynak: "", aciklama: "", deger: true, hata: "", yazilabilir: false,
      kilitSebebi: "sabit", adim: 0, secenekler: [] },
  ],
};
/** Yalnızca çizimin okuduğu kadar pano. */
const pano = {
  goruntu: (ad?: string) => (!ad || ad === "beyin" ? [BEYIN_MODUL] : []),
  olcumDisi: () => false,
  kilitGerekcesi: () => "",
  bekleyenTeyit: () => null,
} as unknown as Pano;
const TEYIT: Teyit = {
  jeton: "t1", dugmeAdi: "beyin.model", etiket: "seçili beyin",
  eski: "claude:haiku", yeni: "yerel:qwen2.5:7b",
  uyari: "Şu an claude:haiku düşünüyor. yerel:qwen2.5:7b beynine geçince mevcut oturumun sohbet " +
    "geçmişi yeni beyne TAŞINMAZ. Geçiş önce sağlık kontrolünden geçer; geçemezse mevcut beyin kalır.",
  eylemler: [], sonTarih: Date.now() + 60_000,
};

const kok = document.getElementById("kok")!;
function tuval(baslik: string): CanvasRenderingContext2D {
  const f = document.createElement("figure");
  const c = document.createElement("canvas");
  c.width = G; c.height = Y;
  const cap = document.createElement("figcaption");
  cap.textContent = baslik;
  f.append(cap, c);
  kok.append(f);
  return c.getContext("2d")!;
}
const semaBag = tuval("şema");
const detayBag = tuval("detay · DÜŞÜNCE");
const teyitBag = tuval("teyit");
const hafizaBag = tuval("detay · HAFIZA (üç kabuk, spec 13 Faz 5)");

// Gerçekçi bir hafıza: içgüdüler, benlik, konuşma penceresi, anılar (birkaçı bu turda hatırlandı).
const w = (kabuk: 0 | 1 | 2, metin: string, boyut = 0.5, soluk = 0, kirmizi = false, sayi = "ö5"): BulutKelimesi =>
  ({ kabuk, metin, not: kabuk === 2 ? `anı · konusma · önem ${Math.round(boyut * 10)} · 3 gün önce · "${metin}"` : "içgüdü", boyut, soluk, sayi, ...(kirmizi ? { kirmizi } : {}) });
const KELIMELER: BulutKelimesi[] = [
  ...["kayit", "kopru.konusma", "kopru.zincir", "kopru.komut", "kopru.hareket_sessiz", "dikkat.tik_yasak", "dikkat.butce",
    "refleks.konusma", "refleks.terminal.kod_hata", "refleks.olay.dunya", "onay.insan"].map((m) => w(0, m)),
  w(1, "git → tahta", 0.7), w(1, "bekliyor: `git status`", 0.7), w(1, "tahtaya git"), w(1, "→ otur"), w(1, "Ozyn: bana gel"),
  w(1, "monitor: terminal açık"),
  w(2, "tahtaya git", 0.6, 0.1, true, "0.81"), w(2, "bana gel", 0.5, 0.05, true, "0.74"), w(2, "masaya git ve otur", 0.7, 0.2),
  w(2, "ner görüyorsun", 0.4, 0.5), w(2, "hata: zaten oturuyorsun", 0.3, 0.6), w(2, "neler yapabilirsin", 0.6, 0.4),
  w(2, "tahtaya adını yaz", 0.8, 0.3, true, "0.66"), w(2, "ozyn_yaklasti", 0.2, 0.7), w(2, "şehri görmek istermisin?", 0.5, 0.2),
  w(2, "python --version", 0.4, 0.3), w(2, "Ozyn komutu reddetti", 0.7, 0.8), w(2, "bilgisayara git", 0.5, 0.4),
  w(2, "serbet düşüncelerini yaz", 0.6, 0.5), w(2, "quantum formülü", 0.5, 0.5), w(2, "kalk", 0.3, 0.2),
];

const olcu = { genislik: G, yukseklik: Y };
function ciz(): void {
  const simdi = Date.now();
  cizSema(semaBag, olcu, { durum, altDurum: "beyin bağlı · Ozyn: \"testler neden kırmızı?\"", simdi });
  cizDetay(detayBag, olcu, "beyin", { durum, pano, simdi, sonYazma: "", sonYazmaAn: 0 });
  cizTeyit(teyitBag, olcu, TEYIT, new Set());
  cizHafizaBulutu(hafizaBag, olcu, { kelimeler: KELIMELER, secili: 22, gercek: false, simdi });
}

// Sahte canlı akış: algıdan bedene bir tur, her 1,6 sn'de.
const TUR = ["algi", "suzgec", "dikkat", "hafiza", "beyin", "niyet", "beden"];
if (!donuk) {
  let i = 0;
  setInterval(() => { durum.vur(TUR[i % TUR.length]!); i++; }, 230);
  const kare = () => { ciz(); requestAnimationFrame(kare); };
  kare();
} else {
  // Donuk kare: bir tur ortası — DİKKAT ve REFLEKS'ten akış var.
  durum.vur("dikkat");
  durum.vur("refleks");
  durum.vur("beyin");
  const an = Date.now();
  const eski = Date.now;
  Date.now = () => an + 450;
  ciz();
  Date.now = eski;
}
