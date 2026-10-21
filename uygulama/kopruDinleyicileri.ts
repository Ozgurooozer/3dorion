// uygulama/kopruDinleyicileri.ts — Köprüye (`Kopru`) bağlanan gözlem ve geri bildirim dinleyicileri.
//
// Eskiden uygulama/giris.ts'teki `beyniBagla`nın içindeydi (mimari düzenleme B1–B2): durum defteri gözlemi (+ takip tiki),
// "temiz sohbet" işareti, arıza göstergesi, Orion'un sözü (altyazı + ses). Her biri köprü kurulduktan sonra giris.ts'te
// eski sırasıyla çağrılır.
"use strict";
import type { Kopru } from "../bridge/kopru.ts";
import type { Avatar } from "../world/avatar/index.ts";
import type { Monitor } from "../world/surfaces/terminal/monitor.ts";
import type { SemaPaneli } from "../world/surfaces/duvar/sema.ts";
import type { GunlukEkrani } from "../world/surfaces/duvar/gunluk.ts";
import type { DavranisDefteri } from "../world/davranisDenemesi.ts";
import type { PiperCikisi } from "../voice/cikis.ts";
import { bulunduguCapa } from "../world/level/capalar.ts";
import { konumluYerOrtasi } from "../world/yer/birlesikYer.ts";
import { ikiCumleyeKisalt } from "../voice/kisalt.ts";
import type { OgretimSatiri } from "../mind/kararKaydi.ts";
import { kabukKoprusu } from "./kabuk.ts";
import type { Takipci } from "./takip.ts";
import type { Yerler } from "./yerGecisi.ts";

type Altyazi = (metin: string, ms?: number) => void;

export function durumGozlemiKur(g: { kopru: Kopru; takipci: Takipci; avatar: Avatar; monitor: Monitor; yerler: Yerler }): void {
  const durumKopru = g.kopru;
  const { takipci, monitor, yerler } = g;
  const a = g.avatar;

  // DURUM DEFTERİ (spec 16 F2): Orion'un bulunduğu yer (çapa adı, ham koordinat değil) ve monitör
  // yarım saniyede bir gözlenir. Defter yalnız DEĞİŞİMİ yazar ve yanından geçmeyi konum saymaz.
  // Model uyanmaz; bilgi bağlama yalnız sorulunca girer (yönlendirici).
  setInterval(() => {
    takipci.tik();
    try {
      durumKopru.durum.konumGozlem(bulunduguCapa(a.durum().konum, durumKopru.durum.oku("konum")?.deger, yerler.orion.capalar)?.etiket ?? konumluYerOrtasi(yerler.orion, a.durum().konum.x, a.durum().konum.z));
      durumKopru.durum.monitor(monitor.acikMi());
    } catch (err) { console.warn("[DURUM] gozlem hatasi:", err); }
  }, 500);
}

export function sohbetKipiIsaretiKur(g: { kopru: Kopru; gunluk: GunlukEkrani }): void {
  const { kopru, gunluk } = g;

  // SOHBET KİPİ (spec 16 F5b): "yeni sohbet" / "temiz sohbet" / "normal sohbet" sözle değişir (köprü,
  // LLM uyanmaz). Temizdeyken ekranın üstünde HEP görünür: hafızanın kapalı olduğu unutulmasın.
  const sohbetIsareti = document.createElement("div");
  sohbetIsareti.style.cssText = "position:fixed;top:10px;left:50%;transform:translateX(-50%);padding:4px 12px;"
    + "border-radius:6px;background:#14202e;color:#ffd38a;font:600 13px system-ui,sans-serif;z-index:50;display:none;pointer-events:none";
  sohbetIsareti.textContent = "TEMİZ SOHBET · hafıza kapalı · çıkmak için: normal sohbet";
  document.body.appendChild(sohbetIsareti);
  kopru.sohbetKipiDinle((kip, e) => {
    sohbetIsareti.style.display = kip === "temiz" ? "block" : "none";
    gunluk.ekle("bilgi", "sohbet", e === "yeni" ? "yeni sohbet: konuşma penceresi sıfırlandı (hafıza duruyor)"
      : e === "temiz" ? "temiz sohbet: hafıza ve durum bağlama girmiyor, hiçbir şey yazılmıyor" : "normal sohbete dönüldü");
  });
}

export function arizaGostergesiKur(g: { kopru: Kopru; altyaziGoster: Altyazi; gunluk: GunlukEkrani; sema: SemaPaneli }): void {
  const { kopru, altyaziGoster, gunluk, sema } = g;

  // ARIZA: beyin düşünemiyorsa odada GÖRÜNÜR olsun.
  //
  // Ölçümle bulundu: OpenRouter `free-models-per-day` kotası dolunca OpenCode
  // HTTP 200 içinde 429 döndürüyor ve 75 sn sonra pes ediyor. Orion sessizce
  // susuyordu; ne Ozyn ne günlük sebebi söylüyordu. Bu Orion'un sözü DEĞİL —
  // sistem bildirimi olarak altyazıya düşer, TTS'e gitmez.
  let sonAriza = 0;
  // Öğretim dosyasına düşen yeni ders (tools/ogret.ts) yeniden başlatmadan uygulanır.
  kabukKoprusu()?.ogretimDinle?.((s) => {
    if (kopru?.ogretimUygula(s as OgretimSatiri)) console.log("[KAPI] yeni ogretim uygulandi");
  });
  kopru.arizaDinle((m) => {
    // Aynı arıza saniyede bir tekrar etmesin; ekranı doldurur.
    const simdi = Date.now();
    if (simdi - sonAriza < 8000) return;
    sonAriza = simdi;
    const kota = /429|rate limit|free-models-per-day/i.test(m);
    altyaziGoster(kota
      ? "⚠ Düşünce kapalı: model sağlayıcı kotası doldu. Orion kurallı kipte."
      : `⚠ Düşünce hatası: ${m.slice(0, 90)}`, 6000);
    gunluk.ekle("hata", "beyin", kota ? `sağlayıcı kotası doldu — ${m}` : m);
    sema.ariza("beyin", true, kota ? "kota doldu" : "hata");
    sema.durumYaz(kota
      ? "düşünce kapalı — sağlayıcı kotası doldu, kurallı kipte"
      : `düşünce hatası: ${m.slice(0, 70)}`);
  });
}

export interface OrionKonusmaAyari {
  altyaziGoster: Altyazi;
  /** Verilirse Orion cevabı ajan satırı olarak yığılır (spec 33: iki ajan aynı anda konuşursa biri ötekini ezmesin). */
  altyaziEkle?: (ad: string, metin: string, ms?: number, adHep?: boolean) => void;
  gunluk: GunlukEkrani;
  davranisKayit: () => ReturnType<DavranisDefteri["kayit"]> | null;
  orionSesi: PiperCikisi;
}

/**
 * ORION'UN SÖZ HATTI: altyazı + günlük + gerçek ses. Köprünün cevabı (`konusmayiBagla`) ve düğüm grafiğinin "Söyle"si (spec 35) AYNI yoldan konuşur: biri
 * kısaltılıp öteki kısaltılmasa "Orion'un sesi" iki kurala bölünürdü. Söz bitince (ses çaldı) çözülür; ses çalmadıysa (Piper yok, boş söz) false.
 */
export function orionKonusmasi(g: OrionKonusmaAyari): (ham: string) => Promise<boolean> {
  const { altyaziGoster, altyaziEkle, gunluk, davranisKayit, orionSesi } = g;
  return async (ham) => {
    // Gevezelik freni: talimat "iki cümle" diyor, model 2/3 koşuda uymuyordu.
    // Kural burada BELİRLEYİCİ biçimde uygulanır (ölçüm: 3dorion.bat davranis).
    const metin = ikiCumleyeKisalt(ham);
    if (!metin) return false;
    if (metin !== ham.trim().replace(/\s+/g, " ")) {
      console.log(`[SOZ] kisaltildi ${ham.length} -> ${metin.length} karakter`);
    }
    const sure = Math.max(2600, metin.length * 70);
    if (altyaziEkle) altyaziEkle("Orion", metin, sure); else altyaziGoster(metin, sure);
    gunluk.ekle("iyi", "orion", metin);
    davranisKayit()?.soyle(metin);
    return orionSesi.soyle(metin);
  };
}

export function konusmayiBagla(g: OrionKonusmaAyari & { kopru: Kopru }): void {
  // Orion konuşunca: altyazı + gerçek ses.
  const konus = orionKonusmasi(g);
  g.kopru.konusmaDinle((ham) => { void konus(ham); });
}
