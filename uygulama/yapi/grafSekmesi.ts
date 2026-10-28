// uygulama/yapi/grafSekmesi.ts — ALT ÇUBUK · GRAF SEKMESİ (spec 35 dilim 1, MVP): grafikler ve desenler, Kontrol et, ▶ Çalıştır / ■ Durdur. DOM katmanı.
//
// Düzenleme GÖRSEL EDİTÖRDE (dilim 2b, uygulama/yapi/graf/grafEditoru.ts): çift tık ya da "Aç". JSON metin görünümü korunur ("Metin": eski düzenleyici
// penceresi). Burası listeler, denetler, çalıştırır; "Yeniden adlandır" ve "Kopyasını oluştur" editörün aynı işlemini çağırır (kurallar tek yerde).
//   • Kartlar iki şeritte: Grafikler (▶ ile çalışan programlar) ve Desenler (başka grafikten tek düğüm olarak çağrılan alt-grafikler). Bozuk dosya kırmızı ve
//     nedeniyle görünür (sessiz kayıp yok). Tık seçer, çift tık düzenleyicide açar.
//   • Kontrol et: kaydedilmiş hâlin biçim hatası (depo) ya da tür denetimi (kütüphane) — hatalar satır satır.
//   • ▶ ÇALIŞTIR YALNIZ OZYN'İN GERÇEK TIKLAMASIYLA: olay `isTrusted` değilse (betikten `.click()`, senaryo, konsol) yok sayılır; Orion'un araç yüzeyinde
//     grafik çalıştıran bir yol yoktur (bekçi: uygulama/graf/ajanDugumleri.test.ts "▶ TEK YERDEN"). Aynı anda tek çalışma; ■ her an.
//   • Çalışırken canlı satır (şu anki düğüm: kimlik + tür adı, desen derinliği, süre); bitince son sonuç (bitti / durdu / hata + hangi düğüm).
//   • ⚡ DİNLEMEYE AL (dilim 2) da YALNIZ GERÇEK TIKLAMAYLA: olay gelince çalıştırma iznidir (bekçi: grafDinleyici.test.ts). Dinlemedekiler sağda listelenir
//     (tetik/atlanan sayıları, bırak, hepsini bırak); ■ bütün süren çalışmaları (▶ + olay) durdurur, dinlemeyi bırakmaz. Seçili grafiğin bellekteki
//     değişkenleri Kontrol et altında (Durumu sıfırla); dilim 3'te ajan kapsamlı değişkenler de.
//   • NPC'LER (dilim 3): üçüncü şerit AYRI dosyada (npcSeridi.ts) — NPC kayıtları ve "⚡ NPC'yi dinlemeye al" (aynı `dinlemeyeAl`, aynı isTrusted kuralı).
// Mantık saf modüllerde ve testli (grafCalistirici.ts, grafDeposu.ts, ajanDugumleri.ts); bu dosya yalnız çizer ve düğmeleri bağlar — DOM'u test edecek bir
// tarayıcı ortamı bu projede yok (hafizaSekmesi.ts gibi), canlı deneme listesi spec 35'te.
"use strict";
import type { Sekme, SekmeAraci, SekmeIcerigi } from "./ortak/yapiPaneli.ts";
import { grafAdiGecerli } from "../../protocol/graf.ts";
import type { GrafDeposu, GrafKaydi } from "../graf/grafDeposu.ts";
import { canliSatir, sonucSatiri, type GrafCalistirici } from "../graf/grafCalistirici.ts";
import type { GrafDinleyici } from "../graf/grafDinleyici.ts";
import { GRAF_SABLONLARI, yeniDesenSablonu } from "../graf/kutuphane.ts";
import { olayTetikleri } from "../graf/olayDugumleri.ts";
import { el } from "./graf/dom.ts";
import { GRAF_SEKMESI_CSS } from "./grafSekmesiStili.ts";
import type { GrafDurumDeposu } from "../graf/grafDurumu.ts";
import { ajanDurumuOgesi, npcSeridiKur, type NpcSeridiAyari } from "./npcSeridi.ts";

export interface GrafSekmesiAyari {
  depo: GrafDeposu;
  calistirici: GrafCalistirici;
  /** ⚡ Dinleme (dilim 2): olay tetikli çalışma. Kurulum yalnız buradan, yalnız gerçek tıklamayla. */
  dinleyici: GrafDinleyici;
  /** Grafiklerin ve (dilim 3) ajanların bellekteki değişkenleri (gösterim ve "Durumu sıfırla"). */
  durum: Pick<GrafDurumDeposu, "ozet" | "sifirla" | "dinle" | "ajanOzet" | "ajanSifirla" | "durumluAjanlar">;
  /** Dilim 3: "NPC'ler" şeridi (ayrı dosya, npcSeridi.ts); verilmezse şerit yok. */
  npc?: NpcSeridiAyari;
  /** Görsel editörde aç (dilim 2b). */
  ac: (ad: string) => void;
  /** JSON metin düzenleyicisinde aç (eski yol; korunur). */
  metinAc: (ad: string) => void;
  /** Yeniden adlandır / kopyasını oluştur: görsel editörün işlemi (açık sekme kirliyse, çalışıyorsa, dinlemedeyse reddeder; kullanılan desen reddedilir). */
  adIslemi: { yenidenAdlandir(eski: string, yeni: string): Promise<void>; kopyasiniOlustur(ad: string, yeni: string): Promise<void> };
  /** Depo yüklenemediyse nedeni. */
  hata: () => string | null;
  bildir: (metin: string, ms?: number) => void;
}


export function grafSekmesi(a: GrafSekmesiAyari): Sekme {
  return {
    id: "graf", ad: "Graf", simge: "🧩", sira: 50,
    ipucu: "Orion ve Flash'ı süren programlar (düğüm grafiği): seç · çift tık görsel editör · Metin: JSON · Kontrol et · ▶ çalıştır · ■ durdur",
    kur(sayfa, arac): SekmeIcerigi { return kur(sayfa, arac, a); },
  };
}

function kur(sayfa: HTMLElement, arac: SekmeAraci, a: GrafSekmesiAyari): SekmeIcerigi {
  const stil = document.createElement("style");
  stil.textContent = GRAF_SEKMESI_CSS;
  document.head.append(stil);
  const dugme = (metin: string, sinif = "", ipucu = ""): HTMLButtonElement => {
    const b = el("button", `gs-dugme ${sinif}`.trim(), metin); b.type = "button"; if (ipucu) b.title = ipucu; return b;
  };

  const kok = el("div", "gs-kok");
  const ust = el("div", "gs-ust");
  const satir = el("div", "gs-satir");
  const calistir = dugme("▶ Çalıştır", "gs-calistir", "Seçili grafiği çalıştır (yalnız senin tıklamanla)");
  const durdur = dugme("■ Durdur", "gs-durdur", "Süren bütün grafikleri hemen durdur (▶ ve olayla çalışanlar; yürüyen ajan da durur, açık diyalog kapanır)");
  const dinleDugme = dugme("⚡ Dinlemeye al", "gs-dinle", "Seçili grafik olay gelince (Ozyn Flash'a yaklaştı…) çalışsın — yalnız senin tıklamanla; uygulama kapanınca biter");
  const kontrolDugme = dugme("Kontrol et", "", "Kaydedilmiş hâlin biçim ve tür denetimi");
  const acDugme = dugme("Aç", "", "Seçili grafiği görsel editörde aç (düğümler, bağlar; çift tık da açar)");
  const metinDugme = dugme("Metin", "", "Seçili grafiği JSON metin düzenleyicisinde aç");
  const adDugme = dugme("Yeniden adlandır", "", "Seçili grafiğin adını değiştir (başka grafiğin çağırdığı desen yeniden adlandırılamaz)");
  const kopyaDugme = dugme("Kopyasını oluştur", "", "Seçili grafiğin aynı içerikli, yeni adlı kopyası");
  const silDugme = dugme("Sil", "gs-sil", "Seçili grafiği/deseni kaldır (dosya silinmez, .silinenler klasörüne taşınır)");
  const yeniGraf = dugme("＋ Yeni grafik", "", "Çalışan bir örnekle başlar (şablon seç): selam — Flash yanına gelir, el sallar; nöbetçi — yaklaşınca parola sorar");
  const yeniDesen = dugme("＋ Yeni desen", "", "Girişli alt-grafik: başka bir grafikte 'Desen' düğümüyle tek düğüm olarak çağrılır");
  const yeniKutu = el("div", "gs-yeni"); yeniKutu.style.display = "none";
  const yeniGirdi = el("input"); yeniGirdi.autocomplete = "off"; yeniGirdi.spellcheck = false;
  const yeniHata = el("span", "gs-yeni-hata");
  // Şablon seçimi (yalnız grafik için): boş sayfa yerine çalışan örnek — selam (▶) ya da nöbetçi (⚡ olay + diyalog).
  const sablonSec = el("select");
  for (const s of GRAF_SABLONLARI) { const o = el("option", "", s.ad); o.value = s.id; sablonSec.append(o); }
  sablonSec.addEventListener("keydown", (e) => e.stopPropagation());
  yeniKutu.append(sablonSec, yeniGirdi, yeniHata);
  ust.append(satir, calistir, durdur, dinleDugme, kontrolDugme, acDugme, metinDugme, adDugme, kopyaDugme, silDugme, yeniKutu, yeniGraf, yeniDesen);

  const govde = el("div", "gs-govde");
  const sutun = (baslik: string) => { const s = el("div", "gs-sutun"); const serit = el("div", "gs-serit"); s.append(el("div", "gs-baslik", baslik), serit); return { s, serit }; };
  const grafikler = sutun("Grafikler (▶ ile ya da ⚡ olayla çalışır)");
  const desenler = sutun("Desenler (tek düğüm olarak çağrılır)");
  const sag = el("div", "gs-sag");
  const dinleme = el("div", "gs-dinleme");
  const kontrol = el("div", "gs-kontrol");
  sag.append(dinleme, kontrol);
  const npcSeridi = a.npc ? npcSeridiKur(a.npc) : null;
  govde.append(grafikler.s, desenler.s, ...(npcSeridi ? [npcSeridi.kok] : []), sag);
  kok.append(ust, govde);
  sayfa.append(kok);

  let secili: string | null = null;
  const kayit = (ad: string | null): GrafKaydi | null => (ad ? a.depo.liste().find((k) => k.ad === ad) ?? null : null);

  // ── üst satır: canlı satır / son sonuç ──
  let saat: ReturnType<typeof setInterval> | null = null;
  function satirCiz(): void {
    const d = a.calistirici.durum();
    if (d.calisiyor) {
      satir.dataset.tur = "calisiyor";
      satir.textContent = canliSatir(d, Date.now());
    } else if (d.son) {
      satir.dataset.tur = d.son.durum;
      satir.textContent = sonucSatiri(d.son);
    } else {
      satir.dataset.tur = "";
      satir.textContent = "Henüz çalıştırılmadı. Bir grafik seç ve ▶ Çalıştır.";
    }
    satir.title = satir.textContent;
    const olayla = a.dinleyici.liste();
    arac.rozet(d.calisiyor || olayla.some((x) => x.calisiyor) ? "▶" : olayla.length ? "⚡" : null);
  }
  function dugmeleriCiz(): void {
    const k = kayit(secili);
    const calisiyor = a.calistirici.durum().calisiyor !== null;
    const neden = calisiyor ? "zaten bir grafik çalışıyor (■ ile durdur)" : !k ? "önce bir grafik seç" : k.hata ? `bozuk: ${k.hata}` : k.tur !== "olay" ? "desen tek başına çalışmaz" : "";
    calistir.disabled = neden !== "";
    calistir.title = neden || `'${k?.ad}' çalıştır (yalnız senin tıklamanla)`;
    durdur.disabled = !calisiyor && !a.dinleyici.liste().some((x) => x.calisiyor);
    // Seçili grafik dinlemedeyse aynı düğme BIRAKIR (bırakmak her zaman serbest); değilse kurar (yalnız gerçek tıklama).
    const dinlemede = !!k && a.dinleyici.dinlemedeMi(k.ad);
    dinleDugme.textContent = dinlemede ? "⚡ Dinlemeyi bırak" : "⚡ Dinlemeye al";
    const g = k ? a.depo.al(k.ad) : null;
    const olaysiz = !!g && g.tur === "olay" && olayTetikleri(g).length === 0;
    dinleDugme.disabled = !k || (!dinlemede && (!!k.hata || k.tur !== "olay" || olaysiz));
    // Neden gri/ne yapar: "olay düğümü yok" hatasını tıklamadan ÖNCE söyle (selam şablonu ▶ ile çalışır, olay dinlemez).
    dinleDugme.title = dinlemede ? "Dinlemeyi bırak"
      : olaysiz ? "Bu grafikte olay düğümü yok (Başla ile ▶ çalışır). Dinlemek için 'Ozyn yaklaştı' gibi bir olay düğümü gerekir — ＋ Yeni grafik → Nöbetçi şablonu bir örnek"
      : "Seçili grafik olay gelince (Ozyn Flash'a yaklaştı…) çalışsın — yalnız senin tıklamanla; uygulama kapanınca biter";
    kontrolDugme.disabled = !k;
    acDugme.disabled = !k || !!k.hata;
    acDugme.title = k?.hata ? "bozuk dosya görsel editörde açılmaz: Metin ile düzelt" : "Seçili grafiği görsel editörde aç (düğümler, bağlar; çift tık da açar)";
    metinDugme.disabled = !k;
    adDugme.disabled = !k || !!k.hata;
    kopyaDugme.disabled = !k || !!k.hata;
    const silNeden = !k ? "önce bir grafik seç" : (a.calistirici.durum().calisiyor?.graf === k.ad || a.dinleyici.calisiyorMu(k.ad)) ? "çalışıyor (önce ■ Durdur)" : dinlemede ? "dinlemede (önce bırak)" : "";
    silDugme.disabled = silNeden !== "";
    if (silNeden) silDugme.title = `Silinemez: ${silNeden}`;
    silDugme.textContent = "Sil"; silDugme.dataset.emin = "0";
  }
  a.calistirici.dinle((d) => {
    satirCiz(); dugmeleriCiz(); kartlariIsaretle();
    if (d.calisiyor && !saat) saat = setInterval(satirCiz, 250);   // geçen süre canlı
    if (!d.calisiyor && saat) { clearInterval(saat); saat = null; }
  });
  a.dinleyici.dinle(() => { dinlemeCiz(); dugmeleriCiz(); kartlariIsaretle(); satirCiz(); });
  a.durum.dinle((d) => { if ((d.kapsam === "ajan" || d.ad === secili) && kontrol.childElementCount) kontrolEt(); });

  // ── ▶ / ■ ──
  calistir.addEventListener("click", (e) => {
    calistir.blur();
    // YALNIZ GERÇEK TIKLAMA: betikten üretilen tık (`el.click()`, senaryo, konsol) programı başlatmaz (spec 35 §1: çalıştıran Ozyn'in tuşu).
    if (!e.isTrusted || !secili) return;
    const r = a.calistirici.calistir(secili);
    if (!r.ok) a.bildir(`çalıştırılamadı: ${r.neden}`, 4000);
  });
  // ■ her şeyi durdurur (▶ çalışması + olay çalışmaları); dinleme SÜRER — bırakmak için "Dinlemeyi bırak". Durdurmak güvenlik yönü: isTrusted istemez.
  durdur.addEventListener("click", () => { durdur.blur(); a.calistirici.durdur(); a.dinleyici.durdur(); });

  // ── ⚡ dinleme ──
  dinleDugme.addEventListener("click", (e) => {
    dinleDugme.blur();
    if (!secili) return;
    if (a.dinleyici.dinlemedeMi(secili)) { a.dinleyici.birak(secili); return; }
    // YALNIZ GERÇEK TIKLAMA (▶ ile aynı kural): dinlemeye almak, olay gelince çalıştırma İZNİDİR; betik bu izni veremez.
    if (!e.isTrusted) return;
    const r = a.dinleyici.dinlemeyeAl(secili);
    if (!r.ok) a.bildir(`dinlemeye alınamadı: ${r.neden}`, 5000);
    else a.bildir(`⚡ ${secili} dinlemede (uygulama kapanınca biter)`, 2500);
  });
  function dinlemeCiz(): void {
    const l = a.dinleyici.liste();
    dinleme.replaceChildren();
    if (!l.length) { dinleme.append(el("div", "gs-alt", "⚡ Dinlemede grafik yok. Bir grafik seç ve ⚡ Dinlemeye al.")); return; }
    const bas = el("div", "gs-dinleme-satir");
    const hepsi = dugme("hepsini bırak", "", "Bütün dinlemeleri bırak (süren olay çalışmaları da durur)");
    hepsi.addEventListener("click", () => { hepsi.blur(); a.dinleyici.hepsiniBirak(); });
    bas.append(el("span", "gs-baslik", `⚡ Dinlemede (${l.length})`), hepsi);
    dinleme.append(bas);
    for (const x of l) {
      const s = el("div", "gs-dinleme-satir");
      s.dataset.calisiyor = x.calisiyor ? "1" : "0";
      const atlanan = x.atlanan.calisiyor + x.atlanan.soguma;
      const yazi = `${x.calisiyor ? "▶" : "⚡"} ${x.npc ? `${x.anahtar} [NPC ${x.npc.ad}]` : x.graf} · ${x.tetikler.map((t) => `${t.ajan}:${t.olay}`).join(", ")} · ${x.tetik} tetik${atlanan ? ` · ${atlanan} atlandı` : ""}`;
      const metin = el("span", "", yazi);
      metin.title = `${yazi}\natlanan: ${x.atlanan.calisiyor} (zaten çalışıyordu) · ${x.atlanan.soguma} (soğuma)${x.son ? `\nson: ${sonucSatiri(x.son)}` : ""}`;
      const birak = dugme("bırak", "", "Dinlemeyi bırak");
      birak.addEventListener("click", () => { birak.blur(); a.dinleyici.birak(x.anahtar); });
      s.append(metin, birak);
      dinleme.append(s);
    }
  }

  // ── Sil (iki adım: ilk tık "Emin misin?", ikinci tık kaldırır; kaldırılan dosya .silinenler'e taşınır) ──
  silDugme.addEventListener("click", (e) => {
    silDugme.blur();
    if (!secili) return;
    const ad = secili;
    if (silDugme.dataset.emin !== "1") {
      // Desen başka grafiklerde kullanılıyorsa silinmez: o grafikler çalışırken 'yok' hatası verirdi.
      const kullanan = a.depo.desenKullananlar(ad);
      if (kullanan.length) { a.bildir(`'${ad}' deseni şunlarda kullanılıyor: ${kullanan.join(", ")} — önce onlardan çıkar`, 5000); return; }
      silDugme.dataset.emin = "1"; silDugme.textContent = `Emin misin? '${ad}'`;
      setTimeout(() => { if (silDugme.dataset.emin === "1") { silDugme.dataset.emin = "0"; silDugme.textContent = "Sil"; } }, 4000);
      return;
    }
    // Silmeye de YALNIZ gerçek tıklama (yanlışlıkla/betikle program kaybı olmasın).
    if (!e.isTrusted) return;
    a.depo.sil(ad).then(() => { a.bildir(`'${ad}' kaldırıldı (dosya .silinenler klasörüne taşındı)`, 3000); secili = null; kontrol.replaceChildren(); ciz(); },
      (err: unknown) => { a.bildir(`silinemedi: ${err instanceof Error ? err.message : String(err)}`, 5000); silDugme.dataset.emin = "0"; silDugme.textContent = "Sil"; });
  });

  // ── Kontrol et ──
  function kontrolEt(): void {
    const k = kayit(secili);
    kontrol.replaceChildren();
    if (!k) return;
    kontrol.append(el("div", "", `Kontrol: ${k.ad} (kaydedilmiş hâli)`));
    const g = a.depo.al(k.ad);
    const hatalar = k.hata ? [k.hata] : g ? a.calistirici.kontrol(g) : ["grafik yüklenemedi"];
    if (!hatalar.length) {
      kontrol.append(el("div", "gs-tamam", k.tur === "olay" ? "✓ hata yok: çalıştırılabilir" : "✓ hata yok (desen: bir grafikte 'Desen' düğümüyle çağrılır)"));
    } else {
      const l = el("ul");
      for (const h of hatalar) l.append(el("li", "", h));
      kontrol.append(el("div", "", `✗ ${hatalar.length} sorun:`), l);
    }
    // Değişkenler (bellekte; uygulama kapanınca gider): nöbetçinin ziyaret sayacı burada görünür ve sıfırlanır.
    const ozet = Object.entries(a.durum.ozet(k.ad));
    if (k.tur !== "olay") return;
    const d = el("div", "gs-durum", ozet.length ? `Durum (bellekte): ${ozet.map(([ad, v]) => `${ad} = ${JSON.stringify(v)}`).join(" · ")}` : "Durum (bellekte): değişken yok");
    if (ozet.length) {
      const sifirla = dugme("Durumu sıfırla", "", "Bu grafiğin değişkenlerini sil (ziyaret sayacı 0'dan başlar)");
      sifirla.addEventListener("click", () => { sifirla.blur(); a.durum.sifirla(k.ad); kontrolEt(); });
      d.append(" ", sifirla);
    }
    kontrol.append(d);
    // Dilim 3: ajan kapsamlı değişkenler (o ajanın bütün grafikleri paylaşır) — NPC kartındakiyle aynı gösterim.
    const ajanlar = ajanDurumuOgesi(a.durum, kontrolEt); if (ajanlar) kontrol.append(ajanlar);
  }
  kontrolDugme.addEventListener("click", () => { kontrolDugme.blur(); kontrolEt(); });
  acDugme.addEventListener("click", () => { acDugme.blur(); if (secili) a.ac(secili); });
  metinDugme.addEventListener("click", () => { metinDugme.blur(); if (secili) a.metinAc(secili); });
  adDugme.addEventListener("click", () => { adDugme.blur(); if (secili) yeniAc("ad"); });
  kopyaDugme.addEventListener("click", () => { kopyaDugme.blur(); if (secili) yeniAc("kopya"); });

  // ── yeni grafik / desen; aynı kutu yeniden adlandırma ve kopya adı için de (kip) ──
  let yeniTur: "olay" | "fonksiyon" | "ad" | "kopya" = "olay";
  const yeniKapat = () => { yeniKutu.style.display = "none"; yeniGraf.style.display = ""; yeniDesen.style.display = ""; yeniGirdi.value = ""; yeniHata.textContent = ""; };
  const yeniAc = (tur: typeof yeniTur) => {
    yeniTur = tur;
    yeniGraf.style.display = "none"; yeniDesen.style.display = "none"; yeniKutu.style.display = "flex";
    sablonSec.style.display = tur === "olay" ? "" : "none";
    yeniGirdi.placeholder = tur === "olay" ? "grafik adı (örn. selam)" : tur === "fonksiyon" ? "desen adı (örn. selamla)" : tur === "ad" ? `'${secili}' için yeni ad` : `'${secili}' kopyasının adı`;
    yeniGirdi.value = tur === "ad" ? secili ?? "" : tur === "kopya" ? `${secili ?? ""}_kopya` : "";
    yeniGirdi.focus(); yeniGirdi.select();
  };
  yeniGraf.addEventListener("click", () => { yeniGraf.blur(); yeniAc("olay"); });
  yeniDesen.addEventListener("click", () => { yeniDesen.blur(); yeniAc("fonksiyon"); });
  yeniGirdi.addEventListener("keydown", (e) => {
    e.stopPropagation();   // yazarken çubuk kısayolları (1–9, Y) ve oyun tuşları çalışmasın
    if (e.key === "Escape") { yeniKapat(); return; }
    if (e.key !== "Enter") return;
    e.preventDefault();
    const ad = yeniGirdi.value.trim();
    if (!grafAdiGecerli(ad)) { yeniHata.textContent = "geçersiz ad (harf, rakam, _ ve -; boşluk yok)"; return; }
    if (yeniTur === "ad" || yeniTur === "kopya") {
      const eski = secili;
      if (!eski) { yeniKapat(); return; }
      if (yeniTur === "ad" && ad === eski) { yeniKapat(); return; }
      const is = yeniTur === "ad" ? a.adIslemi.yenidenAdlandir(eski, ad) : a.adIslemi.kopyasiniOlustur(eski, ad);
      void is.then(() => { yeniKapat(); secili = ad; ciz(); }, (err: unknown) => { yeniHata.textContent = err instanceof Error ? err.message : String(err); });
      return;
    }
    if (kayit(ad)) { yeniHata.textContent = "bu ad zaten var"; return; }
    const sablon = GRAF_SABLONLARI.find((s) => s.id === sablonSec.value) ?? GRAF_SABLONLARI[0]!;
    const g = yeniTur === "olay" ? sablon.kur(ad) : yeniDesenSablonu(ad);
    void a.depo.yeni(g).then(() => { yeniKapat(); secili = ad; ciz(); a.ac(ad); }, (err: unknown) => { yeniHata.textContent = err instanceof Error ? err.message : String(err); });
  });
  yeniGirdi.addEventListener("keyup", (e) => e.stopPropagation());

  // ── kartlar ──
  const kartlar = new Map<string, HTMLElement>();
  function kart(k: GrafKaydi): HTMLElement {
    const c = el("div", "gs-kart");
    c.dataset.bozuk = k.hata ? "1" : "0";
    c.title = `${k.ad}${k.aciklama ? `\n${k.aciklama}` : ""}${k.hata ? `\n✗ ${k.hata}` : ""}\nTık: seç · Çift tık: ${k.hata ? "JSON'u düzelt (Metin)" : "görsel editörde aç"}`;
    c.append(el("div", "gs-ad", `${k.tur === "fonksiyon" ? "🧩" : k.hata ? "⚠" : "▶"} ${k.ad}`), el("div", "gs-alt", k.hata ? `bozuk: ${k.hata}` : k.aciklama ?? ""));
    c.addEventListener("click", () => { secili = k.ad; kontrol.replaceChildren(); kartlariIsaretle(); dugmeleriCiz(); });
    // Bozuk dosya görsel editörde açılamaz (biçim çözülemedi): çift tık onu JSON düzenleyicide açar.
    c.addEventListener("dblclick", () => (k.hata ? a.metinAc(k.ad) : a.ac(k.ad)));
    kartlar.set(k.ad, c);
    return c;
  }
  function kartlariIsaretle(): void {
    const calisan = a.calistirici.durum().calisiyor?.graf ?? null;
    for (const [ad, c] of kartlar) {
      c.dataset.secili = ad === secili ? "1" : "0";
      c.dataset.calisiyor = ad === calisan || a.dinleyici.calisiyorMu(ad) ? "1" : "0";
      c.dataset.dinliyor = a.dinleyici.dinlemedeMi(ad) ? "1" : "0";
    }
  }
  function ciz(): void {
    const liste = a.depo.liste();
    if (secili && !liste.some((k) => k.ad === secili)) secili = null;
    kartlar.clear();
    // Bozuk dosyanın türü bilinmiyorsa grafiklerin arasında görünür (orada nedeniyle durur).
    const olaylar = liste.filter((k) => k.tur !== "fonksiyon"), fonksiyonlar = liste.filter((k) => k.tur === "fonksiyon");
    const h = a.hata();
    grafikler.serit.replaceChildren(...(olaylar.length ? olaylar.map(kart) : [el("div", "gs-bos", h ? `Grafikler yüklenemedi: ${h}` : "Henüz grafik yok. ＋ Yeni grafik ile çalışan bir örnekle başla.")]));
    desenler.serit.replaceChildren(...(fonksiyonlar.length ? fonksiyonlar.map(kart) : [el("div", "gs-bos", "Henüz desen yok.")]));
    kartlariIsaretle(); dugmeleriCiz(); satirCiz(); dinlemeCiz(); npcSeridi?.ciz();
  }
  // Abonelik sekme ömrü boyunca açık: kaydedince kart (bozuk/açıklama) çubuk kapalıyken de güncel kalır.
  a.depo.dinle((o) => { if (o.tur === "liste") ciz(); });
  return { goster() { ciz(); arac.ipucu("Tık: seç · Çift tık / Aç: görsel editör · Metin: JSON · Kontrol et · ▶ / ■"); } };
}
