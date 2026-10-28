// uygulama/senaryolar/dokdene.ts — `3dorion.bat dokdene` (spec 39 D3): dok sistemi ÇALIŞMA ANINDA — bölgeler, sürükle-bırak, izin kuralı, boyut, yüzer, kalıcılık.
//
// Ölçülenler, hepsi SONUÇ olarak (tuval payı, bölge, depo içeriği):
//   K1  editör açık → sağ bölgede 3 panel; --dok-sag yazılı; tuval o kadar dar.   K2  editör gizli → bölge kapalı, pay kalktı, tuval tam.
//   K3  API taşıma (sağ→sol): sol açılır, --dok-sol, tuval soldan kayar.            K4  izinsiz bölge (Rig→alt): RET + neden ekranda.
//   K5  GERÇEK sürükle-bırak (DragEvent) Ayrıntılar→alt hedefi: alt açılır, --dok-alt, tuval kısalır.
//   K6  izinsiz gerçek sürükleme (Rig→alt): düzen değişmez, uyarı görünür.          K7  aynı bölgede sürükleyerek yeniden sıralama.
//   K8  kenar tutamağıyla boyut (sağ): --dok-sag büyür, sınırda kalır.              K9  yüzer pencere: açılır, başlıktan taşınır, ⇲ ile bölgeye döner.
//   K10 kapat + Pencere menüsünden geri aç.                                        K11 düzen depoya yazıldı (gidiş-dönüş AYNI).
//   K12 tuşlar oyuna sızmaz (dok içinden).                                         K13 editör kapanıp açılınca paneller bıraktığı yerde.
// Kareler ORION_SS_DIR'e PNG. Gerçek kullanıcının kayıtlı dok düzeni bozulmasın diye başta saklanır, sonda geri yazılır.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";

const ANAHTAR = "orion.dok.v1";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[DOKDENE] " + m);
  let gecen = 0, kalan = 0;
  const kontrol = (ad: string, ok: boolean, ek = "") => { if (ok) gecen++; else kalan++; log(`${ok ? "GECTI" : "KALDI"} ${ad}${ek ? ` — ${ek}` : ""}`); };
  const bitir = () => console.log(`[DOKDENE] ${kalan === 0 ? "GECTI" : "KALDI"} — ${gecen}/${gecen + kalan}`);
  const ss = async (ad: string) => { console.log("[KLIPSS] " + ad); await bekle(400); };

  const dok = d.dok;
  const kayitliOnce = (() => { try { return localStorage.getItem(ANAHTAR); } catch { return null; } })();
  const geriYaz = () => { try { if (kayitliOnce === null) localStorage.removeItem(ANAHTAR); else localStorage.setItem(ANAHTAR, kayitliOnce); } catch { /* depo yok */ } };

  const kok = document.documentElement;
  const pay = (b: string) => parseFloat(kok.style.getPropertyValue(`--dok-${b}`)) || 0;
  const tuval = () => document.getElementById("tuval")!.getBoundingClientRect();
  const bolge = (b: string) => document.querySelector<HTMLElement>(`.dk-bolge[data-bolge="${b}"]`)!;
  const sekmeler = (b: string) => [...bolge(b).querySelectorAll<HTMLElement>(".dk-sekme")].map((s) => s.dataset.panel ?? "");
  const sekme = (id: string) => document.querySelector<HTMLElement>(`.dk-sekme[data-panel="${id}"]`)!;
  const hedef = (b: string) => document.querySelector<HTMLElement>(`.dk-hedef[data-bolge="${b}"]`)!;
  const ipucuMetni = () => { const i = document.querySelector<HTMLElement>(".dk-ipucu"); return i?.dataset.acik === "1" ? (i.textContent ?? "") : ""; };
  const surukleBirak = (kaynak: HTMLElement, h: HTMLElement, x = 0, y = 0) => {
    const v = new DataTransfer();
    kaynak.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: v }));
    h.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: v, clientX: x, clientY: y }));
    h.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: v, clientX: x, clientY: y }));
    kaynak.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: v }));
  };
  const A = "sekans-ayrinti", R = "sekans-rig", K = "sekans-kamera";

  dok.sifirla();
  await d.sekans.hazir();
  const acilan = await d.sekans.ornegiAc("selamlasma");
  await bekle(700);

  // K1
  const t1 = tuval();
  kontrol("K1 editör açık: sağ bölgede Ayrıntılar·Rig·Kamera; --dok-sag yazılı; tuval o kadar dar",
    !!acilan && bolge("sag").dataset.acik === "1" && sekmeler("sag").join(",") === `${A},${R},${K}` && pay("sag") === 310 && Math.abs(t1.width - (innerWidth - 310)) <= 1 && t1.left === 0,
    `sağ=${sekmeler("sag").join(",")} pay=${pay("sag")} tuval w=${t1.width} (pencere ${innerWidth})`);
  await ss("01_sag_bolge");

  // K3 (K2'den önce: editör açıkken taşı) — API
  const s3 = dok.tasi(K, "sol");
  await bekle(150);
  const t3 = tuval();
  kontrol("K3 Kamera sağ→sol: sol açıldı, --dok-sol=300, tuval soldan kaydı ve iki payı düştü",
    s3.ok && bolge("sol").dataset.acik === "1" && sekmeler("sol").join(",") === K && pay("sol") === 300 && Math.abs(t3.left - 300) <= 1 && Math.abs(t3.width - (innerWidth - 300 - 310)) <= 1,
    `sol=${sekmeler("sol")} sağ=${sekmeler("sag")} tuval left=${t3.left} w=${t3.width}`);

  // K4 izinsiz (API)
  const onceki = JSON.stringify(dok.duzen().gruplar);
  const s4 = dok.tasi(R, "alt");
  await bekle(120);
  kontrol("K4 Rig→alt İZİNSİZ: ret kodu, neden ekranda, düzen değişmedi",
    !s4.ok && s4.ret === "bolge-izinsiz" && /Rig paneli alt bölgeye bırakılamaz/.test(ipucuMetni()) && JSON.stringify(dok.duzen().gruplar) === onceki,
    s4.ok ? "ok" : `${s4.ret} · ekran: ${ipucuMetni()}`);

  // K5 gerçek sürükle-bırak
  surukleBirak(sekme(A), hedef("alt"), 400, innerHeight - 20);
  await bekle(200);
  const t5 = tuval();
  kontrol("K5 sürükle-bırak Ayrıntılar→alt: alt açıldı, --dok-alt=300, tuval kısaldı",
    bolge("alt").dataset.acik === "1" && sekmeler("alt").join(",") === A && pay("alt") === 300 && sekmeler("sag").join(",") === R && t5.height < t3.height - 200,
    `alt=${sekmeler("alt")} sağ=${sekmeler("sag")} tuval h=${t5.height} (öncesi ${t3.height})`);
  await ss("02_sol_sag_alt");

  // K6 izinsiz gerçek sürükleme
  const once6 = JSON.stringify(dok.duzen().gruplar);
  const hedefIzin = hedef("alt").dataset.izinli;
  surukleBirak(sekme(R), hedef("alt"), 400, innerHeight - 20);
  await bekle(150);
  kontrol("K6 sürükle Rig→alt (izinsiz): düzen değişmez, uyarı görünür, sürükleme hedefleri kapandı",
    JSON.stringify(dok.duzen().gruplar) === once6 && /bırakılamaz/.test(ipucuMetni()) && document.querySelector<HTMLElement>(".dk-kok")!.dataset.surukle === "0",
    `izin(önceki hedef)=${hedefIzin} · ${ipucuMetni()}`);

  // K7 aynı bölgede yeniden sıralama: Kamera'yı sağa al, sonra Rig'in SOLUNA sürükle
  dok.tasi(K, "sag"); await bekle(120);
  const rigKutu = sekme(R).getBoundingClientRect();
  surukleBirak(sekme(K), bolge("sag").querySelector<HTMLElement>(".dk-seritler")!, rigKutu.left + 2, rigKutu.top + 5);
  await bekle(150);
  kontrol("K7 aynı bölgede sürükleyerek sıra: Kamera, Rig'in soluna geçti", sekmeler("sag").join(",") === `${K},${R}`, sekmeler("sag").join(","));

  // K8 boyut: sağ tutamak
  const tut = bolge("sag").querySelector<HTMLElement>(".dk-tutamak")!;
  const x0 = innerWidth - pay("sag");
  tut.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 7, clientX: x0, clientY: 300 }));
  tut.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 7, clientX: x0 - 100, clientY: 300 }));
  const genis = pay("sag");
  tut.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 7, clientX: -5000, clientY: 300 }));
  const sinir = pay("sag");
  tut.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 7 }));
  kontrol("K8 kenar tutamağı: 310→410 px; uçta 720 px sınırında kalır; tuval buna göre daraldı",
    genis === 410 && sinir === 720 && Math.abs(tuval().width - (innerWidth - pay("sol") - 720)) <= 1, `${genis} → ${sinir} · tuval w=${tuval().width}`);
  dok.sifirla(); dok.tasi(K, "sol"); await bekle(120);

  // K9 yüzer
  const s9 = dok.tasi(R, "yuzer");
  await bekle(200);
  const pen = document.querySelector<HTMLElement>(`.dk-yuzer[data-panel="${R}"]`);
  const k9 = dok.duzen().yuzerKonum[R];
  const icerikPencerede = !!pen?.querySelector(".dk-yuzer-icerik > [data-dok]");   // panelin içeriği (kopya değil, taşınan öğe) pencerenin gövdesinde
  const bas = pen?.querySelector<HTMLElement>(".dk-yuzer-bas");
  const sol0 = pen?.offsetLeft ?? 0;
  bas?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 9, clientX: sol0 + 40, clientY: (pen?.offsetTop ?? 0) + 10 }));
  bas?.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 9, clientX: sol0 + 190, clientY: (pen?.offsetTop ?? 0) + 60 }));
  bas?.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 9 }));
  await bekle(120);
  const k9b = dok.duzen().yuzerKonum[R];
  kontrol("K9 yüzer: Rig kendi penceresinde, sağ bölgeden çıktı (Ayrıntılar kaldı); başlıktan taşınınca konum modele yazıldı",
    s9.ok && !!pen && sekmeler("sag").join(",") === A && !!k9 && !!k9b && k9b.x === k9.x + 150 && k9b.y === k9.y + 50 && icerikPencerede,
    `konum ${k9?.x},${k9?.y} → ${k9b?.x},${k9b?.y}`);
  await ss("03_yuzer");
  pen?.querySelector<HTMLElement>(".dk-ikon")?.click();   // ilk ikon ⇲ yerleştir
  await bekle(150);
  kontrol("K9b ⇲ yerleştir: Rig varsayılan bölgesine (sağ) döndü, pencere kalktı",
    dok.duzen().gruplar.sag.includes(R) && !document.querySelector(`.dk-yuzer[data-panel="${R}"]`) && bolge("sag").dataset.acik === "1", `sağ=${sekmeler("sag")}`);

  // K10 kapat + Pencere menüsünden geri aç
  dok.kapat(K); await bekle(120);
  const kapaliYazildi = dok.duzen().kapali.includes(K) && sekmeler("sol").length === 0 && bolge("sol").dataset.acik === "0" && pay("sol") === 0;
  const serit = document.querySelector<HTMLElement>(".kb-ustserit");
  [...(serit?.querySelectorAll<HTMLElement>(".kb-menu-dugme") ?? [])].find((x) => x.textContent === "Pencere")?.click();
  await bekle(250);
  const satir = [...(serit?.querySelectorAll<HTMLElement>(".kb-menu[data-acik='1'] .kb-oge") ?? [])].find((x) => x.querySelector(".kb-oge-ad")?.textContent === "Kamera");
  const isaretsiz = !!satir && !/✓/.test(satir.textContent ?? "");
  await ss("04_pencere_menusu");
  satir?.click(); await bekle(200);
  kontrol("K10 kapatılan panel bölgeden kalktı; Pencere menüsünde işaretsiz, tıklayınca geri açıldı",
    kapaliYazildi && isaretsiz && !dok.duzen().kapali.includes(K) && dok.ekrandaMi(K), `kapalı=${dok.duzen().kapali} · menü satırı=${satir ? "var" : "YOK"} işaretsiz=${isaretsiz}`);

  // K11 depo
  let depodaki: { gruplar?: unknown } | null = null;
  try { depodaki = JSON.parse(localStorage.getItem(ANAHTAR) ?? "null"); } catch { /* */ }
  kontrol("K11 düzen depoya yazıldı (gruplar canlı düzenle AYNI)", !!depodaki && JSON.stringify(depodaki.gruplar) === JSON.stringify(dok.duzen().gruplar), depodaki ? "yazıldı" : "depo boş/okunamadı");

  // K12 tuş sızıntısı
  let sizan = 0; const dinle = () => { sizan++; };
  addEventListener("keydown", dinle);
  const hedefTus = sekmeler("sag").length ? sekme(sekmeler("sag")[0]!) : sekme(sekmeler("sol")[0]!);
  hedefTus.dispatchEvent(new KeyboardEvent("keydown", { key: "w", code: "KeyW", bubbles: true }));
  removeEventListener("keydown", dinle);
  kontrol("K12 dok içindeki tuş oyuna (pencere dinleyicisine) sızmıyor", sizan === 0, `sızan=${sizan}`);

  // K2 / K13 editör gizle → aç
  const duzenOnce = JSON.stringify(dok.duzen().gruplar);
  d.sekans.editor.gizle(); await bekle(300);
  const t2 = tuval();
  kontrol("K2 editör gizli: bütün dok bölgeleri kapalı, --dok-* kalktı, tuval tam genişlik (sol=0)",
    ["sol", "sag", "alt"].every((b) => bolge(b).dataset.acik === "0" && pay(b) === 0) && t2.left === 0 && Math.abs(t2.width - innerWidth) <= 1, `tuval left=${t2.left} w=${t2.width}`);
  await d.sekans.ornegiAc("selamlasma"); await bekle(500);
  kontrol("K13 editör yeniden açıldı: paneller bıraktığı bölgelerde, düzen aynı", JSON.stringify(dok.duzen().gruplar) === duzenOnce && sekmeler("sag").length + sekmeler("sol").length + sekmeler("alt").length === 3,
    `sol=${sekmeler("sol")} sağ=${sekmeler("sag")} alt=${sekmeler("alt")}`);

  d.sekans.editor.gizle(); await bekle(300);
  dok.sifirla(); geriYaz();
  bitir();
}
