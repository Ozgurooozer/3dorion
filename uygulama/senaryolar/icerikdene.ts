// uygulama/senaryolar/icerikdene.ts — `3dorion.bat icerikdene` (spec 39 D4): İÇERİK GEZGİNİ ÇALIŞMA ANINDA, geçici projede (ORION_SMOKE: gerçek projeye yazılmaz).
//
// Ölçülenler, hepsi SONUÇ olarak (gerçek DOM olayı → diskteki dosya listesi):
//   K0  ilk/sıfırlanmış düzende panel KAPALI (oyun alanı daralmaz); açınca alt bölgede.   K1  ağaç: Content+Engine, yedi tür klasörü; kök kartları.
//   K2  Characters/Orion ve Levels/ova PAKET kartı (tür karakter/level), çift tık hedefi dosya.
//   K3  sağ tık menüsü Orion kartında: Aç/Klasörü aç/Yeniden adlandır/Çoğalt/Explorer/Favori/Sil hepsi AÇIK.
//   K4  sekans kartına GERÇEK çift tık → sekans editörü o sekansla açılır.   K5  menüden Çoğalt → `_kopya` dosyası diskte; çift tıkla açılır (depo tazelendi).
//   K6  F2 → satır içi ad girdisi → Enter: dosya adlandı; geçersiz ad RET + mesaj, ad aynı.   K7  Delete → listeden gitti, Content/.silinenler'de var (içerik korunur).
//   K8  Engine salt okunur: kart 🔒, Yeniden adlandır/Çoğalt/Sil GRİ + neden, ＋Klasör kapalı.   K9  korumalı tür klasörü (Levels): adlandır/sil GRİ, F2 uyarı.
//   K10 içe aktar: iki png kopyalandı, klasör atlandı + neden mesajda; kartlarda küçük görsel yüklendi (img naturalWidth>0).
//   K11 ＋Klasör (satır içi girdi) → klasör diskte, çift tıkla içine girilir, kırıntı son adresi gösterir.   K12 arama (alt klasörlerde, harf farkı yok) ve tür süzgeci (Engine'de model).
//   K13 favori: ekle → yan listede; localStorage'a yazıldı; çıkar.   K14 panel sola taşınınca içerik aynı (dok bölgesi değişir, panel çalışır).
//   D5 önizleme: K15 Orion'a çift tık → karakter tanımı → beden glb yüklendi (üçgen>1000, kemik≥20, mesh isReady, kareler çiziliyor, viewport dolu), bileşenler+ayrıntılar dolu;
//   K16 kemik görünümü; K17 ANA SAHNE kaydı korundu (ikinci motor örtük sahneyi çalmadı); K18 Engine glb'ye çift tık; K19 görsele çift tık.
//   D6 Outliner: K20 nesne=satır, gruplu; K21 satır tıkla → sahne seçimi; K22 sahne seçimi → panel; K23 arama; K24 'İçerikte göster'; K25 seçimi kaldır.
// Kareler ORION_SS_DIR'e PNG. Gerçek kullanıcının dok düzeni ve favorileri başta saklanır, sonda geri yazılır; oluşturulanlar sonda .silinenler'e taşınır.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { MenuOgesi } from "../yapi/ortak/menuModeli.ts";

const DOK_ANAHTARI = "orion.dok.v1", FAVORI_ANAHTARI = "orion.icerik.favoriler.v1", GORUNUM_ANAHTARI = "orion.icerik.gorunum.v1";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[ICERIKDENE] " + m);
  let gecen = 0, kalan = 0;
  const kontrol = (ad: string, ok: boolean, ek = "") => { if (ok) gecen++; else kalan++; log(`${ok ? "GECTI" : "KALDI"} ${ad}${ek ? ` — ${ek}` : ""}`); };
  const bitir = () => console.log(`[ICERIKDENE] ${kalan === 0 ? "GECTI" : "KALDI"} — ${gecen}/${gecen + kalan}`);
  const ss = async (ad: string) => { console.log("[KLIPSS] " + ad); await bekle(400); };
  const oku = (a: string) => { try { return localStorage.getItem(a); } catch { return null; } };
  const yaz = (a: string, v: string | null) => { try { if (v === null) localStorage.removeItem(a); else localStorage.setItem(a, v); } catch { /* depo yok */ } };
  const onceki = { dok: oku(DOK_ANAHTARI), favori: oku(FAVORI_ANAHTARI), gorunum: oku(GORUNUM_ANAHTARI) };
  const geriYaz = () => { yaz(DOK_ANAHTARI, onceki.dok); yaz(FAVORI_ANAHTARI, onceki.favori); yaz(GORUNUM_ANAHTARI, onceki.gorunum); };

  const p = d.icerik, dok = d.dok, k = window.kopru;
  const damga = Date.now().toString(36);
  const olusanlar: string[] = [];   // sonda silinecek adresler

  const panel = () => document.querySelector<HTMLElement>(".ic-kok")!;
  const kartEl = (adres: string) => [...document.querySelectorAll<HTMLElement>(".ic-kart")].find((c) => c.dataset.adres === adres) ?? null;
  const kartAdlari = () => p.gorunenKartlar().map((c) => c.ad);
  const dugumEl = (adres: string) => [...document.querySelectorAll<HTMLElement>(".ic-dugum")].find((c) => c.dataset.adres === adres) ?? null;
  const fare = (e: HTMLElement, tur: string, x = 0, y = 0) => e.dispatchEvent(new MouseEvent(tur, { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  const menuSatirlari = () => [...document.querySelectorAll<HTMLElement>(".bm-liste .bm-satir")].map((s) => ({ ad: s.querySelector(".bm-ad")?.textContent ?? "", gri: s.dataset.gri === "1", neden: s.title, el: s }));
  const menuKapat = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  const menuAc = (adres: string) => { const e = kartEl(adres)!; const r = e.getBoundingClientRect(); fare(e, "contextmenu", r.left + 20, r.top + 20); return menuSatirlari(); };
  const menudenSec = async (ad: string) => { const s = menuSatirlari().find((x) => x.ad === ad); if (s) s.el.click(); await bekle(500); return s; };
  const tus = (e: HTMLElement, key: string) => e.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  const diskte = async (adres: string) => {
    const kok = adres.split("/")[0] as "Content" | "Engine";
    const r = await k.icerikListe(kok);
    return r.ok && r.deger.ogeler.some((o) => o.adres === adres);
  };
  const adGir = async (yeni: string) => {
    const g = document.querySelector<HTMLInputElement>(".ic-ad-girdi");
    if (!g) return false;
    g.value = yeni; tus(g, "Enter"); await bekle(600); return true;
  };

  // ── K0 ──
  dok.sifirla();
  await bekle(150);
  const kapaliBasta = !dok.ekrandaMi("icerik") && dok.duzen().kapali.includes("icerik");
  kontrol("K0 sıfırlanmış düzende İçerik paneli KAPALI (Pencere menüsünde var, oyun alanı daralmadı)", kapaliBasta && !document.querySelector(".dk-bolge[data-bolge=\"alt\"][data-acik=\"1\"]"),
    `kapalı=${dok.duzen().kapali.join(",")}`);
  const menuSatiri = dok.menuSatirlari().find((s): s is MenuOgesi => typeof s !== "string" && s.etiket === "İçerik");
  kontrol("K0b Pencere menüsünde 'İçerik' satırı var, işaretsiz", !!menuSatiri && menuSatiri.isaretli?.() === false);
  dok.sec("icerik");
  await p.yenile();
  await bekle(500);

  // ── K1 ──
  const turKlasorleri = ["Levels", "Characters", "Animations", "Sequences", "Graphs", "NPC", "Assets"];
  const altAcik = document.querySelector<HTMLElement>(".dk-bolge[data-bolge=\"alt\"]")?.dataset.acik === "1";
  const kokKartlari = kartAdlari();
  kontrol("K1 panel alt bölgede açıldı; ağaçta Content + Engine ve yedi tür klasörü; kök kartları aynı yedi klasör",
    dok.ekrandaMi("icerik") && altAcik && panel().offsetHeight > 100 && !!dugumEl("Content") && !!dugumEl("Engine") && turKlasorleri.every((t) => !!dugumEl(`Content/${t}`))
      && turKlasorleri.every((t) => kokKartlari.includes(t)) && kokKartlari.length === 7,
    `kartlar=${kokKartlari.join(",")} panel h=${panel().offsetHeight}`);
  await ss("01_panel");

  // ── K2 ──
  p.git("Content/Characters");
  const ch = p.gorunenKartlar();
  p.git("Content/Levels");
  const lv = p.gorunenKartlar();
  kontrol("K2 Characters/Orion ve Levels/ova PAKET kartı: tür karakter/level, çift tık hedefi dosya",
    ch.length === 1 && ch[0]!.tur === "karakter" && ch[0]!.ac.endsWith("/Orion/Orion.karakter.json") && lv.length >= 1 && lv.some((c) => c.tur === "level" && c.ac.endsWith(`/${c.ad}/${c.ad}.level.json`)),
    `karakter=${ch.map((c) => `${c.ad}:${c.tur}`).join(",")} level=${lv.map((c) => `${c.ad}:${c.tur}`).join(",")}`);

  // ── K3 ──
  p.git("Content/Characters");
  const m3 = menuAc("Content/Characters/Orion");
  const beklenen3 = ["Aç", "Klasörü aç", "Yeniden adlandır", "Çoğalt", "Explorer'da göster", "Favorilere ekle", "Sil"];
  kontrol("K3 Orion kartının sağ tık menüsü: yedi satır, hepsi AÇIK", beklenen3.every((a) => m3.some((s) => s.ad === a && !s.gri)) && m3.filter((s) => s.ad).length === 7, `satırlar=${m3.map((s) => `${s.ad}${s.gri ? "(gri)" : ""}`).join(" | ")}`);
  await ss("02_orion_menusu");
  menuKapat(); await bekle(150);

  // ── K4 ──
  await d.sekans.hazir();
  const sekAd = await d.sekans.ornegiAc("selamlasma");
  d.sekans.editor.gizle();
  await bekle(300);
  await p.yenile();
  p.git("Content/Sequences");
  const sekAdres = `Content/Sequences/${sekAd}.json`;
  const sekKart = kartEl(sekAdres);
  kontrol("K4a sekans kartı Content/Sequences'ta, türü sekans", !!sekAd && !!sekKart && sekKart.dataset.tur === "sekans", `sekans=${sekAd} kartlar=${kartAdlari().join(",")}`);
  if (sekKart) fare(sekKart, "dblclick");
  await bekle(600);
  kontrol("K4b çift tık → sekans editörü o sekansla açıldı", d.sekans.editor.acikMi() && d.sekans.editor.etkinOturum()?.sekans().ad === sekAd, `açık=${d.sekans.editor.acikMi()} ad=${d.sekans.editor.etkinOturum()?.sekans().ad}`);
  d.sekans.editor.gizle(); await bekle(200);

  // ── K5 ──
  menuAc(sekAdres);
  await menudenSec("Çoğalt");
  const kopyaAdi = `${sekAd}_kopya`, kopyaAdres = `Content/Sequences/${kopyaAdi}.json`;
  olusanlar.push(kopyaAdres);
  const kopyaVar = await diskte(kopyaAdres);
  const kopyaKart = kartEl(kopyaAdres);
  if (kopyaKart) fare(kopyaKart, "dblclick");
  await bekle(600);
  kontrol("K5 menüden Çoğalt → `_kopya` dosyası diskte, kartı var; çift tıkla açılır (depo tazelendi)",
    kopyaVar && !!kopyaKart && d.sekans.editor.acikMi() && d.sekans.editor.etkinOturum()?.sekans().ad === kopyaAdi, `disk=${kopyaVar} kart=${!!kopyaKart} açık=${d.sekans.editor.etkinOturum()?.sekans().ad}`);
  d.sekans.editor.gizle(); await bekle(200);

  // ── K6 ──
  const yeniAdi = `${sekAd}_yeni`, yeniAdres = `Content/Sequences/${yeniAdi}.json`;
  p.sec(kopyaAdres);
  tus(panel(), "F2"); await bekle(200);
  const girdiVar = !!document.querySelector(".ic-ad-girdi");
  const girdiyiBirak = () => { const g = document.querySelector<HTMLInputElement>(".ic-ad-girdi"); if (g) tus(g, "Escape"); };
  await adGir(`${yeniAdi}.json`);
  const adlandi = (await diskte(yeniAdres)) && !(await diskte(kopyaAdres));
  if (adlandi) { olusanlar.pop(); olusanlar.push(yeniAdres); }
  // geçersiz ad
  p.sec(adlandi ? yeniAdres : kopyaAdres);
  tus(panel(), "F2"); await bekle(200);
  await adGir("kosu 1.json");
  const ret = p.mesaj();
  const adAyni = adlandi ? await diskte(yeniAdres) : false;
  girdiyiBirak();
  kontrol("K6a F2 → satır içi girdi → Enter: dosya adlandı (eski ad gitti)", girdiVar && adlandi, `girdi=${girdiVar} yeni=${await diskte(yeniAdres)}`);
  kontrol("K6b geçersiz ad ('kosu 1.json') REDDEDİLDİ: hata mesajı ekranda, dosya adı aynı", ret.tur === "hata" && /gecersiz|geçersiz|olmalı/i.test(ret.metin) && adAyni, `mesaj=${ret.tur}: ${ret.metin}`);

  // ── K7 ──
  p.sec(yeniAdres);
  tus(panel(), "Delete"); await bekle(700);
  const silinenVar = await (async () => { const r = await k.icerikListe("Content"); return r.ok && !r.deger.ogeler.some((o) => o.adres === yeniAdres); })();
  const silMesaji = p.mesaj();
  kontrol("K7 Delete → kart/dosya listeden gitti, mesaj '.silinenler' diyor (kalıcı silme yok)", silinenVar && !kartEl(yeniAdres) && /silinenler/.test(silMesaji.metin), `mesaj=${silMesaji.metin}`);
  olusanlar.pop();

  // ── K8 ──
  p.git("Engine");
  const eK = kartEl("Engine/orion-lowpoly.glb");
  const m8 = eK ? menuAc("Engine/orion-lowpoly.glb") : [];
  const gri = (a: string) => m8.find((s) => s.ad === a);
  kontrol("K8 Engine kartı: model türü, 🔒; Yeniden adlandır/Çoğalt/Sil GRİ ve nedenli; Aç/Explorer açık; ＋Klasör kapalı",
    !!eK && eK.dataset.tur === "model" && !!eK.querySelector(".ic-rozet") && ["Yeniden adlandır", "Çoğalt", "Sil"].every((a) => gri(a)?.gri === true && (gri(a)?.neden ?? "").length > 3)
      && gri("Aç")?.gri === false && gri("Explorer'da göster")?.gri === false && document.querySelectorAll<HTMLButtonElement>(".ic-arac button")[0]!.disabled,
    `satırlar=${m8.map((s) => `${s.ad}${s.gri ? `(gri:${s.neden})` : ""}`).join(" | ")}`);
  await ss("03_engine_menusu");
  menuKapat(); await bekle(150);

  // ── K9 ──
  p.git("Content");
  const m9 = menuAc("Content/Levels");
  const f2Oncesi = p.mesaj().metin;
  menuKapat(); await bekle(100);
  p.sec("Content/Levels"); tus(panel(), "F2"); await bekle(150);
  const korumaMesaji = p.mesaj();
  kontrol("K9 korumalı tür klasörü (Levels): Yeniden adlandır/Çoğalt?/Sil GRİ; F2 girdi AÇMAZ, uyarı verir",
    ["Yeniden adlandır", "Sil"].every((a) => m9.find((s) => s.ad === a)?.gri === true) && !document.querySelector(".ic-ad-girdi") && korumaMesaji.tur === "uyari" && korumaMesaji.metin !== f2Oncesi,
    `satırlar=${m9.map((s) => `${s.ad}${s.gri ? "(gri)" : ""}`).join(" | ")} mesaj=${korumaMesaji.metin}`);

  // ── K10 ──
  p.git("Content/Assets");
  const oncekiKartlar = new Set(kartAdlari());
  const aktarildi = await p.iceAktar();
  await bekle(500);
  const yeniler = p.gorunenKartlar().filter((c) => !oncekiKartlar.has(c.ad));
  for (const y of yeniler) olusanlar.push(y.adres);
  const aktMesaj = p.mesaj();
  // küçük görsel yüklenmesini bekle (en çok 5 sn)
  let resimSayisi = 0;
  for (let i = 0; i < 25 && resimSayisi < 2; i++) { await bekle(200); resimSayisi = [...document.querySelectorAll<HTMLImageElement>(".ic-kart .ic-onizleme img")].filter((im) => im.naturalWidth > 0).length; }
  kontrol("K10a içe aktar: iki png kopyalandı (görsel kartı), klasör ATLANDI ve nedeni mesajda",
    aktarildi && yeniler.length === 2 && yeniler.every((c) => c.tur === "gorsel") && /atlanan/.test(aktMesaj.metin) && /kaynak/.test(aktMesaj.metin), `yeni=${yeniler.map((c) => c.ad).join(",")} mesaj=${aktMesaj.metin}`);
  kontrol("K10b kartlarda küçük görsel önizleme yüklendi (img naturalWidth>0)", resimSayisi >= 2, `yüklü img=${resimSayisi}`);
  await ss("04_ice_aktar_onizleme");

  // ── K11 ──
  const klasorAdi = `Dene-${damga}`, klasorAdresi = `Content/Assets/${klasorAdi}`;
  (document.querySelectorAll<HTMLButtonElement>(".ic-arac button")[0]!).click();
  await bekle(250);
  const girdi11 = !!document.querySelector(".ic-ad-girdi");
  await adGir(klasorAdi);
  olusanlar.push(klasorAdresi);
  const kl = kartEl(klasorAdresi);
  const klasorDiskte = await diskte(klasorAdresi);
  if (kl) fare(kl, "dblclick");
  await bekle(300);
  const kirintiSon = [...document.querySelectorAll<HTMLElement>(".ic-kirinti span[data-adres]")].at(-1)?.dataset.adres;
  kontrol("K11 ＋Klasör → satır içi girdi → Enter: klasör diskte; çift tıkla içine girilir, kırıntı son adresi gösterir",
    girdi11 && klasorDiskte && !!kl && p.klasor() === klasorAdresi && kirintiSon === klasorAdresi, `girdi=${girdi11} disk=${klasorDiskte} klasör=${p.klasor()} kırıntı=${kirintiSon}`);

  // ── K12 ──
  p.git("Content");
  p.ara("POSTER");
  const aranan = p.gorunenKartlar();
  p.ara("");
  p.git("Engine");
  p.turSuz(["model"]);
  const modeller = p.gorunenKartlar();
  kontrol("K12 arama alt klasörlerde ve harf farkı gözetmez (POSTER → poster png'leri); Engine'de model süzgeci orion-lowpoly.glb'yi bulur, hepsi model",
    aranan.length >= 1 && aranan.every((c) => /poster/i.test(c.ad) && c.tur === "gorsel" && c.adres.startsWith("Content/Assets/")) && modeller.some((c) => c.ad === "orion-lowpoly.glb") && modeller.every((c) => c.tur === "model"),
    `arama=${aranan.map((c) => c.ad).join(",")} modeller=${modeller.length}`);
  await ss("05_arama_suzgec");
  p.turSuz([]);

  // ── K13 ──
  p.git("Content/Characters");
  p.favori("Content/Characters/Orion");
  const yanda = !!document.querySelector(".ic-dugum[data-favori=\"Content/Characters/Orion\"]");
  const kayitli = (oku(FAVORI_ANAHTARI) ?? "").includes("Content/Characters/Orion");
  p.favori("Content/Characters/Orion");
  kontrol("K13 favori: yan listede görünür, localStorage'a yazıldı; ikinci kez çıkarır", yanda && kayitli && p.favoriler().length === 0 && !document.querySelector(".ic-dugum[data-favori]"), `yanda=${yanda} kayıt=${kayitli}`);

  // ── K14 ──
  const t = dok.tasi("icerik", "sol");
  await bekle(300);
  p.git("Content/Characters");
  const solda = !!document.querySelector(".dk-bolge[data-bolge=\"sol\"] .ic-kok");
  kontrol("K14 panel sola taşındı: sol bölgede, kartlar çalışıyor (Orion paketi)", t.ok && solda && kartAdlari().includes("Orion") && !!kartEl("Content/Characters/Orion"), `ok=${t.ok} solda=${solda}`);
  await ss("06_solda");
  dok.tasi("icerik", "alt");
  await bekle(300);

  // ── K26–K29 · kullanım kolaylığı ──
  p.git("Content/Sequences");
  const adlar26 = [...document.querySelectorAll<HTMLElement>(".ic-kart .ic-ad")].map((x) => x.textContent ?? "");
  kontrol("K26 kartta uzantı gürültüsü yok (sekans 'x.json' değil 'x' görünür), tam ad ipucunda", adlar26.length > 0 && adlar26.every((n) => !n.endsWith(".json")) && [...document.querySelectorAll<HTMLElement>(".ic-kart")].every((c) => c.title.includes(".json")), `adlar=${adlar26.join(",")}`);
  const etiketler = [...document.querySelectorAll<HTMLElement>(".ic-suzgec button")].map((b) => b.textContent ?? "");
  kontrol("K27 tür süzgeci düğmeleri adlı (yalnız ikon değil) ve 'Tümü' var, süzgeç yokken Tümü işaretli", etiketler[0] === "Tümü" && etiketler.length === 10 && etiketler.every((x) => x.length > 2) && document.querySelector<HTMLElement>(".ic-suzgec button[data-tumu]")!.dataset.acik === "1", `etiketler=${etiketler.join("|")}`);
  // ok tuşları: sağ → sıradaki kart, Home → ilk, End → son
  p.git("Content/Assets");
  const kartSirasi = () => [...document.querySelectorAll<HTMLElement>(".ic-kart[data-adres]")].map((c) => c.dataset.adres!);
  const sira0 = kartSirasi();
  panel().focus();
  tus(panel(), "Home"); const s1 = p.secili();
  tus(panel(), "ArrowRight"); const s2 = p.secili();
  tus(panel(), "End"); const s3 = p.secili();
  kontrol("K28 ok tuşlarıyla gezinme: Home ilk, → ikinci, End son kartı seçer", sira0.length >= 2 && s1 === sira0[0] && s2 === sira0[1] && s3 === sira0.at(-1), `sıra=${sira0.length} home=${s1} sağ=${s2} end=${s3}`);
  // kart boyutu kaydırıcısı + ağaç ayırıcısı: değer CSS değişkenine yansır ve kalıcı olur
  const zoom = document.querySelector<HTMLInputElement>(".ic-zoom input")!;
  const kartEn0 = document.querySelector<HTMLElement>(".ic-kart")!.getBoundingClientRect().width;
  zoom.value = "160"; zoom.dispatchEvent(new Event("input", { bubbles: true }));
  await bekle(150);
  const kartEn1 = document.querySelector<HTMLElement>(".ic-kart")!.getBoundingClientRect().width;
  const kayitGorunum = oku(GORUNUM_ANAHTARI) ?? "";
  zoom.value = "104"; zoom.dispatchEvent(new Event("input", { bubbles: true }));
  const ayirac = document.querySelector<HTMLElement>(".ic-ayirac")!, yanEl = document.querySelector<HTMLElement>(".ic-yan")!;
  const yan0 = yanEl.getBoundingClientRect().width;
  ayirac.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 200, pointerId: 7 }));
  ayirac.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 290, pointerId: 7 }));
  ayirac.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 290, pointerId: 7 }));
  await bekle(100);
  const yan1 = yanEl.getBoundingClientRect().width;
  ayirac.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  const yan2 = yanEl.getBoundingClientRect().width;
  kontrol("K29 kart boyutu kaydırıcısı kartı büyütür ve kaydedilir; ağaç ayırıcısı sürüklenince genişler, çift tık sıfırlar", kartEn1 > kartEn0 + 30 && kayitGorunum.includes("160") && yan1 > yan0 + 60 && Math.abs(yan2 - yan0) < 2, `kart ${kartEn0.toFixed(0)}→${kartEn1.toFixed(0)} · yan ${yan0.toFixed(0)}→${yan1.toFixed(0)}→${yan2.toFixed(0)}`);
  await ss("13_kullanim");

  // ── K30 · keşfedilebilirlik: `I` tuşu İçerik gezginini kapatıp açar (Pencere menüsüne bakmadan) ──
  const idenTus = () => document.body.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyI", key: "i", bubbles: true, cancelable: true }));
  idenTus(); await bekle(250);
  const iKapandi = !dok.ekrandaMi("icerik");
  idenTus(); await bekle(300);
  const iAcildi = dok.ekrandaMi("icerik") && panel().offsetHeight > 100;
  const menuI = dok.menuSatirlari().find((s): s is MenuOgesi => typeof s !== "string" && s.etiket === "İçerik");
  kontrol("K30 'I' tuşu İçerik gezginini kapatır ve geri açar", iKapandi && iAcildi && !!menuI, `kapandı=${iKapandi} açıldı=${iAcildi}`);

  // ── K15 · D5: karakter önizleme ──
  const ov = d.onizleme;
  const bekleHazir = async (ms = 20000) => { for (let i = 0; i < ms / 200; i++) { const x = ov.durum(); if (x.hazir || x.hata) return x; await bekle(200); } return ov.durum(); };
  p.git("Content/Characters");
  const orionKart = kartEl("Content/Characters/Orion");
  if (orionKart) fare(orionKart, "dblclick");
  const o1 = await bekleHazir();
  for (let i = 0; i < 20 && ov.durum().kare < 3; i++) await bekle(150);
  await bekle(400);
  const dolu = ov.doluluk();
  const o1s = ov.durum();
  kontrol("K15a Orion'a çift tık → önizleme açıldı: karakter tanımı okundu, beden Engine/orion-lowpoly.glb, yüklendi (hata yok)",
    !!orionKart && o1.hazir && !o1.hata && o1.tur === "karakter" && o1.karakter?.beden === "Engine/orion-lowpoly.glb" && dok.ekrandaMi("varlik-onizleme") && document.querySelector<HTMLElement>(".vp-kok")!.offsetHeight > 100,
    `hazir=${o1.hazir} hata=${o1.hata} tür=${o1.tur} beden=${o1.karakter?.beden}`);
  kontrol("K15b önizleme ÖLÇÜSÜ: üçgen>1000, kemik≥20, her çizilebilir mesh isReady, kamera kareleri çiziliyor, viewport zeminden farklı piksel var (beden çizildi)",
    !!o1.ozet && o1.ozet.ucgen > 1000 && o1.ozet.iskeletler.reduce((t, i) => t + i.kemik, 0) >= 20 && o1s.meshToplam > 0 && o1s.meshHazir === o1s.meshToplam && o1s.kare > 2 && dolu > 0.02,
    `üçgen=${o1.ozet?.ucgen} kemik=${o1.ozet?.iskeletler.reduce((t, i) => t + i.kemik, 0)} mesh=${o1s.meshHazir}/${o1s.meshToplam} kare=${o1s.kare} doluluk=${dolu.toFixed(3)} anim=${o1s.animasyon}`);
  const bilesenSatiri = document.querySelectorAll(".vp-sol .vp-satir").length, ayrintiDt = [...document.querySelectorAll(".vp-sag dt")].map((x) => x.textContent);
  kontrol("K15c Bileşenler ağacı (mesh+kemik+malzeme satırları) ve Ayrıntılar (Üçgen/Köşe/Kemik/Ölçü) dolu", bilesenSatiri >= 10 && ["Üçgen", "Köşe", "Kemik", "Ölçü", "Dosya"].every((x) => ayrintiDt.includes(x)), `bileşen satırı=${bilesenSatiri} ayrıntılar=${ayrintiDt.join(",")}`);
  await ss("07_onizleme_karakter");
  ov.kemikleriGoster(true);
  await bekle(600);
  const dolu2 = ov.doluluk();
  kontrol("K16 kemik görünümü açıldı (SkeletonViewer), çizim sürüyor", ov.durum().kemikGorunur && dolu2 > 0.02, `kemikGorunur=${ov.durum().kemikGorunur} doluluk=${dolu2.toFixed(3)}`);
  await ss("08_onizleme_kemik");
  ov.kemikleriGoster(false);
  const sahneKorundu = (await import("@babylonjs/core/Engines/engineStore")).EngineStore.LastCreatedScene === d.sahne;
  kontrol("K17 ANA SAHNE korundu: Babylon'un 'son oluşturulan sahne' kaydı hâlâ oyunun sahnesi (ikinci motor örtük sahneyi çalmadı)", sahneKorundu);

  p.git("Engine");
  const glbKart = kartEl("Engine/orion-lowpoly.glb");
  if (glbKart) fare(glbKart, "dblclick");
  const o2 = await bekleHazir();
  kontrol("K18 Engine'deki glb'ye çift tık → model olarak yüklendi; üçgen sayısı karakterin bedeniyle AYNI (aynı dosya)", !!glbKart && o2.hazir && o2.tur === "model" && o2.karakter === null && o2.ozet?.ucgen === o1.ozet?.ucgen && o2.adres === "Engine/orion-lowpoly.glb",
    `tür=${o2.tur} üçgen=${o2.ozet?.ucgen}/${o1.ozet?.ucgen} hata=${o2.hata}`);

  p.git("Content/Assets");
  const resimKart = p.gorunenKartlar().find((c) => c.tur === "gorsel");
  const rk = resimKart ? kartEl(resimKart.adres) : null;
  if (rk) fare(rk, "dblclick");
  const o3 = await bekleHazir();
  await bekle(300);
  const im = document.querySelector<HTMLImageElement>(".vp-gorunum img");
  kontrol("K19 görsele çift tık → önizlemede resim gösterildi (naturalWidth>0)", !!rk && o3.hazir && o3.tur === "gorsel" && !!im && im.naturalWidth > 0, `tür=${o3.tur} img=${im?.naturalWidth}`);
  await ss("09_onizleme_gorsel");
  ov.kapat();

  // ── K20 · D6: Level Outliner ──
  const nesneler = d.yerler().ozyn.nesneler;
  const benzersiz = new Set(nesneler.map((n) => n.id));
  dok.sec("outliner");
  await bekle(500);
  const ot = d.outliner;
  ot.tazele();   // 1 sn'lik zamanlayıcıyı bekleme (dünya nesneleri açılıştan sonra da eklenir)
  const satirlar0 = ot.satirlar();
  kontrol("K20 Outliner açıldı (Pencere ▸ Outliner, sağ bölge); sahnedeki her nesne tam bir satır, türlere gruplu",
    dok.ekrandaMi("outliner") && !!document.querySelector(".dk-bolge[data-bolge=\"sag\"] .ot-kok") && benzersiz.size > 3 && satirlar0.length === benzersiz.size && ot.grupSayisi() >= 2 && satirlar0.every((r) => benzersiz.has(r.id)),
    `nesne=${benzersiz.size} satır=${satirlar0.length} grup=${ot.grupSayisi()}`);
  await ss("10_outliner");
  const ilkSatir = document.querySelector<HTMLElement>(".ot-satir")!;
  const ilkId = ilkSatir.dataset.id!;
  ilkSatir.click();
  await bekle(250);
  kontrol("K21 satıra tıklamak SAHNEDEKİ seçimi değiştirir (secim durumu = o nesne), satır işaretlenir", d.secim.oku()?.id === ilkId && ot.satirlar().filter((r) => r.secili).map((r) => r.id).join() === ilkId, `secim=${d.secim.oku()?.id} satır=${ot.satirlar().filter((r) => r.secili).map((r) => r.id).join()}`);
  const baska = nesneler.find((n) => n.id !== ilkId)!;
  d.secim.sec(baska);
  await bekle(250);
  kontrol("K22 sahnede seçim değişince panel de güncellenir (ters yön): yalnız yeni nesne işaretli", ot.satirlar().filter((r) => r.secili).map((r) => r.id).join() === baska.id, `beklenen=${baska.id} gerçek=${ot.satirlar().filter((r) => r.secili).map((r) => r.id).join()}`);
  await ss("11_outliner_secim");
  ot.ara(baska.ad);
  const otAranan = ot.satirlar();
  ot.ara("");
  kontrol("K23 arama: nesnenin adı yalnız eşleşenleri bırakır (hepsi adı/kimliği/türü içerir), boşalınca hepsi geri gelir",
    otAranan.length >= 1 && otAranan.length < benzersiz.size && otAranan.some((r) => r.id === baska.id) && ot.satirlar().length === benzersiz.size, `eşleşen=${otAranan.length}/${benzersiz.size}`);
  const icerikD = [...document.querySelectorAll<HTMLButtonElement>(".ot-arac button")].find((b) => /İçerikte/.test(b.textContent ?? ""))!;
  icerikD.click();
  await bekle(600);
  const info = await k.projeBilgi();
  const levelAdi = info.ok ? info.deger?.varsayilanLevel : null;
  kontrol("K24 'İçerikte göster': İçerik gezgini Content/Levels'a gitti ve projenin level'ını seçti", !!levelAdi && p.klasor() === "Content/Levels" && p.secili() === `Content/Levels/${levelAdi}` && dok.ekrandaMi("icerik"), `klasör=${p.klasor()} seçili=${p.secili()} level=${levelAdi}`);
  await ss("12_icerikte_goster");
  const birak = [...document.querySelectorAll<HTMLButtonElement>(".ot-arac button")].find((b) => /Seçimi kaldır/.test(b.textContent ?? ""))!;
  birak.click();
  await bekle(250);
  kontrol("K25 'Seçimi kaldır' sahnedeki seçimi temizler ve satır işareti kalkar", d.secim.oku() === null && ot.satirlar().every((r) => !r.secili));
  // ── K32 · Outliner satırına çift tık → kamera nesneye gider ──
  const hedefNesne = nesneler.find((n) => n.id !== ilkId)!;
  const satir32 = document.querySelector<HTMLElement>(`.ot-satir[data-id="${CSS.escape(hedefNesne.id)}"]`);
  const kamOnce = d.rig.gorunum().konum.clone();
  if (satir32) { fare(satir32, "click"); fare(satir32, "click"); fare(satir32, "dblclick"); }
  await bekle(1500);
  const kamSonra = d.rig.gorunum();
  const uzaklik = Math.hypot(kamSonra.hedef.x - hedefNesne.kutu.x, kamSonra.hedef.y - hedefNesne.kutu.y, kamSonra.hedef.z - hedefNesne.kutu.z);
  kontrol("K32 satıra çift tık: nesne seçili kalır (iki tıkın ikincisi kaldırmaz) ve kamera ona bakar/yaklaşır", !!satir32 && d.secim.oku()?.id === hedefNesne.id && uzaklik < 1.5 && kamSonra.konum.subtract(kamOnce).length() > 0.05,
    `seçim=${d.secim.oku()?.id} bakış-uzaklık=${uzaklik.toFixed(2)} kamera-kayma=${kamSonra.konum.subtract(kamOnce).length().toFixed(2)}`);
  d.rig.sinematikBitir();
  dok.kapat("outliner"); dok.kapat("varlik-onizleme");

  // ── K31 · kartı klasöre sürükle → taşınır; geçersiz hedef kabul edilmez ──
  p.git("Content/Assets");
  await bekle(300);
  const tasinacak = p.gorunenKartlar().find((c) => c.tur === "gorsel");
  const dKart = tasinacak ? kartEl(tasinacak.adres) : null, dKlasor = kartEl(klasorAdresi);
  const surukle = (e: HTMLElement, tur: string, v: DataTransfer) => { const o = new DragEvent(tur, { bubbles: true, cancelable: true, dataTransfer: v }); e.dispatchEvent(o); return o; };
  let kabul = false, izgaraKabul = true, yeniAdres31 = "";
  if (tasinacak && dKart && dKlasor) {
    const v = new DataTransfer();
    surukle(dKart, "dragstart", v);
    const izg = document.querySelector<HTMLElement>(".ic-izgara")!;
    izgaraKabul = surukle(izg, "dragover", v).defaultPrevented;   // aynı klasöre bırakmak = zaten orada
    kabul = surukle(dKlasor, "dragover", v).defaultPrevented;
    surukle(dKlasor, "drop", v);
    surukle(dKart, "dragend", v);
    await bekle(700);
    yeniAdres31 = `${klasorAdresi}/${tasinacak.ad}`;
    const i = olusanlar.indexOf(tasinacak.adres);
    if (i >= 0) olusanlar[i] = yeniAdres31;
  }
  const tasindi = !!tasinacak && await diskte(yeniAdres31) && !(await diskte(tasinacak.adres));
  kontrol("K31 kartı klasör kartına sürükle-bırak: dosya taşındı (eski yer boş); aynı klasöre bırakma kabul EDİLMEZ", !!tasinacak && kabul && !izgaraKabul && tasindi, `kabul=${kabul} izgaraKabul=${izgaraKabul} taşındı=${tasindi} → ${yeniAdres31}`);

  // ── temizlik: oluşturulanlar .silinenler'e ──
  for (const a of olusanlar.reverse()) { const r = await k.icerikSil(a); if (!r.ok) log(`temizlik: ${a} silinemedi (${r.mesaj})`); }
  dok.kapat("icerik");
  geriYaz();
  bitir();
}
