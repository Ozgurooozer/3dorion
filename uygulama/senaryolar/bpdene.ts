// uygulama/senaryolar/bpdene.ts — `3dorion.bat bpdene` (spec 45 B7): BLUEPRINT JSON ARAYÜZÜ ÇALIŞMA ANINDA, gerçek DOM + gerçek level + gerçek Babylon düğümü + gerçek host dosyası (geçici proje: ORION_SMOKE).
//
// Ölçülenler, hepsi SONUÇ olarak:
//   P1  Nesneler paneli açılır, Details'te Hiyerarşi + Bileşenler bölümü var.      P2  DÜZEN: panel alt dok'un altında kalmıyor; Details kayar; "+ Bileşen" düğmesine kaydırınca ULAŞILIR (elementFromPoint).
//   P3  "+ Bileşen" (tetik): tanıma girer, şema satırları çizilir, "Şekil" açılır liste.   P4  geçersiz yarıçap (−5) reddedilir, tanım ve giriş eski hâlinde kalır.
//   P5  üst/soket seçicileriyle hiyerarşi kurulur: liste çocuğu girintiyle gösterir; üst "(yok)" olunca bağ ve soket gider.
//   P6  GÜVENLİK: sentetik (isTrusted=false) "Şablon olarak kaydet" ve "Yerleştir" tıklaması DİSKE/LEVEL'A YAZMAZ.
//   P7  host: şablon yaz → listele → oku (gerçek IPC); aynı ad reddedilir; yerleştirilen aktörler GERÇEK levelKur'dan geçer ve sahnede düğüm olur (R29'un koşulmayanı).
//   P8  glb soketi: gerçek nesne düğümünün altına `soket_deneme` düğümü konur, "glb soketleri" düğmesi onu soket bileşeni yapar; konum nesne köküne göre (gerçek glb'nin `__root__` dönüşümü dahil).
//   P10 DEMOLAR (spec 45 B9): lamba/kutu/kılıç/araba GERÇEK glb ve gerçek level'a yerleşir; gerçek Ozyn konumuyla tetik girdi/çıktı; hareket komutu gerçek düğümü sürer ve durdurur;
//       kılıç Orion'un GERÇEK sağ elinin dünya matrisine oturur. ⚡ graf zinciri burada YOK: dinlemeyi yalnız Ozyn'in gerçek tıklaması kurar (birim testte gerçek bileşenlerle kanıtlı).
// Kareler ORION_SS_DIR'e PNG. Sonda her şey eski hâline döner (bileşenler, üst, yerleştirilen aktörler, sahte düğüm).
"use strict";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import { NESNELER_PANELI_KIMLIGI } from "../yapi/level/nesnelerPaneli.ts";
import { sablonKaydet, sablonAdlari, sablonYerlestirMetinden } from "../aktor/sablonIslemleri.ts";
import { glbDugumleriniOku } from "../aktor/glbDugumleri.ts";
import { DEMOLAR, DEMO_ADLARI, kimlikEsle, type DemoAdi, type Kimlikler } from "../aktor/demolar.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[BPDENE] " + m);
  let gecen = 0, kalan = 0;
  const kontrol = (ad: string, ok: boolean, ek = "") => { if (ok) gecen++; else kalan++; log(`${ok ? "GECTI" : "KALDI"} ${ad}${ek ? ` — ${ek}` : ""}`); };
  const bitir = () => console.log(`[BPDENE] ${kalan === 0 ? "GECTI" : "KALDI"} — ${gecen}/${gecen + kalan}`);
  const ss = async (ad: string) => { console.log("[KLIPSS] " + ad); await bekle(400); };

  const { baglanti: b, level: levelGetir } = d.levelIsik;
  const kopru = window.kopru;
  const tik = async (e: Element | null) => { e?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); await bekle(250); };
  // Gerçek kullanıcı önce odaklanır: panel odak içindeyken 1 sn'lik yenileme Details'i yeniden KURMAZ (nesnelerPaneli). Odaksız değişiklik yenilemeyle yarışır.
  const degistir = async (e: HTMLSelectElement | HTMLInputElement | null, v: string) => { if (!e) return; e.focus(); e.value = v; e.dispatchEvent(new Event("change", { bubbles: true })); await bekle(250); };
  const kok = () => b.nesneler.kok;
  const detay = () => kok().querySelector<HTMLElement>(".il-detay");
  const satirlar = () => [...kok().querySelectorAll<HTMLElement>(".il-satir")];
  const bolum = (onek: string) => [...(detay()?.querySelectorAll<HTMLElement>(".il-bolum") ?? [])].find((x) => (x.textContent ?? "").startsWith(onek)) ?? null;
  const ekleDugmesi = () => [...(detay()?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((x) => (x.textContent ?? "").startsWith("+ Bileşen")) ?? null;
  const ustSecici = () => detay()?.querySelector<HTMLSelectElement>("select[title^='Bu aktör hangi aktörün']") ?? null;
  const soketSecici = () => detay()?.querySelector<HTMLSelectElement>("select[title^='Üstteki hangi soket']") ?? null;
  const bilesenSatirSayisi = () => detay()?.querySelectorAll("button[title='Bileşeni sil']").length ?? 0;

  // ── hazırlık ──
  d.ayarAc(); await bekle(300); d.ayarKapat();
  d.dok.sec(NESNELER_PANELI_KIMLIGI);
  await bekle(400);
  for (let n = 0; n < 125 && levelGetir() === null; n++) await bekle(200);
  const l0 = levelGetir();
  if (!l0) { kontrol("P0 level hazır", false, "level yok"); bitir(); return; }
  const ilkTanim = JSON.stringify(l0.tanim());
  const adaylar = (l0.tanim().nesneler ?? []).filter((n) => n.id && !n.ust);
  if (adaylar.length < 2) { kontrol("P0 en az iki üstsüz nesne var", false, `nesne=${adaylar.length}`); bitir(); return; }
  const A = adaylar[0]!.id!, B = adaylar[1]!.id!;
  const tanimA = () => l0.tanim().nesneler?.find((n) => n.id === A);
  const tanimB = () => l0.tanim().nesneler?.find((n) => n.id === B);
  b.nesneler.tazele();
  b.nesneler.sec(A);
  await bekle(400);

  // ── P1 ──
  kontrol("P1 Nesneler paneli ekranda; Details'te 'Hiyerarşi' ve 'Bileşenler (0/8)' bölümleri var, üst ve soket seçicileri çizili",
    d.dok.ekrandaMi(NESNELER_PANELI_KIMLIGI) && bolum("Hiyerarşi") !== null && (bolum("Bileşenler")?.textContent ?? "").includes("(0/8)") && ustSecici() !== null && soketSecici() !== null,
    `ekranda=${d.dok.ekrandaMi(NESNELER_PANELI_KIMLIGI)} hiyerarşi=${bolum("Hiyerarşi") !== null} bileşenler='${bolum("Bileşenler")?.textContent ?? "yok"}' seçici=${ustSecici() !== null}/${soketSecici() !== null}`);
  await ss("01_panel");

  // ── P2: DÜZEN (Ozyn'in gördüğü kusur: sol panel alt dok'un altında kalıyor mu) ──
  const alt = document.querySelector<HTMLElement>(".dk-bolge[data-bolge='alt']");
  const sol = document.querySelector<HTMLElement>(".dk-bolge[data-bolge='sol']");
  const kokKutu = kok().getBoundingClientRect(), altKutu = alt?.getBoundingClientRect() ?? null, solKutu = sol?.getBoundingClientRect() ?? null;
  const altGorunur = alt !== null && altKutu !== null && altKutu.height > 0 && getComputedStyle(alt).display !== "none";
  const altUst = altGorunur && altKutu ? altKutu.top : innerHeight;
  kontrol("P2a panel kutusu alt dok'un üstünde biter (altına taşmaz) ve pencere dışına çıkmaz",
    kokKutu.bottom <= altUst + 1 && kokKutu.bottom <= innerHeight + 1,
    `panelAlt=${Math.round(kokKutu.bottom)} altDokÜst=${Math.round(altUst)} altDokGörünür=${altGorunur} pencereYük=${innerHeight} solBölgeAlt=${solKutu ? Math.round(solKutu.bottom) : "yok"}`);
  // Detay uzasın: dört bileşen ekle (tavan 8), sonra kaydırılabilirlik ve erişilebilirlik ölç.
  for (const tur of ["tetik", "soket", "hareket", "isik"]) {
    const sec = ekleDugmesi()?.parentElement?.querySelector<HTMLSelectElement>("select") ?? null;
    if (sec) await degistir(sec, tur);
    await tik(ekleDugmesi());
  }
  b.nesneler.tazele(); await bekle(300);
  const dt = detay()!;
  const kayar = dt.scrollHeight > dt.clientHeight;
  dt.scrollTop = dt.scrollHeight; await bekle(200);
  const eb = ekleDugmesi();
  eb?.scrollIntoView({ block: "center" }); await bekle(200);
  const r = eb?.getBoundingClientRect();
  const noktadaki = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
  const ulasilir = !!eb && !!noktadaki && (noktadaki === eb || eb.contains(noktadaki));
  kontrol("P2b 4 bileşenden sonra Details KAYAR ve '+ Bileşen' düğmesi kaydırınca TIKLANABİLİR (üstünü başka bir şey örtmüyor)",
    kayar && ulasilir,
    `scrollHeight=${dt.scrollHeight} clientHeight=${dt.clientHeight} düğmeAlt=${r ? Math.round(r.bottom) : "yok"} noktadakiEleman=${noktadaki ? noktadaki.tagName + "." + (noktadaki as HTMLElement).className : "yok"}`);
  // Teşhis: kaymıyorsa hangi üst kutunun boyu sınırlamıyor? Detay'dan dok bölgesine her atanın yüksekliği, hesaplanan height/overflow/display.
  const zincir: string[] = [];
  for (let e: HTMLElement | null = dt; e && zincir.length < 9; e = e.parentElement) {
    const c = getComputedStyle(e);
    zincir.push(`${e.className || e.tagName}[h=${e.clientHeight} sh=${e.scrollHeight} css=${c.height} ov=${c.overflowY} d=${c.display} pos=${c.position}]`);
  }
  log("ZINCIR " + zincir.join(" < "));
  await ss("02_dort_bilesen");

  // ── P3 ──
  const bl = () => tanimA()?.bilesenler ?? [];
  const tetik = bl().find((x) => x.tur === "tetik");
  const sekilSecici = detay()?.querySelector<HTMLSelectElement>("select option[value='kutu']")?.parentElement as HTMLSelectElement | null;
  kontrol("P3 '+ Bileşen' ile tanıma 4 bileşen girdi (tetik, soket, hareket, ışık), şema satırları çizildi ('Şekil' AÇILIR LİSTE: kure/kutu)",
    bl().length === 4 && ["tetik", "soket", "hareket", "isik"].every((t) => bl().some((x) => x.tur === t)) && sekilSecici !== null && bilesenSatirSayisi() === 4,
    `bileşenler=${bl().map((x) => x.tur + ":" + x.id).join(",")} satır=${bilesenSatirSayisi()} şekilListesi=${sekilSecici !== null}`);

  // ── P4 ──
  const yaricapGirdisi = [...(detay()?.querySelectorAll<HTMLLabelElement>("label") ?? [])].find((x) => (x.textContent ?? "").startsWith("Yarıçap"))?.nextElementSibling as HTMLInputElement | null;
  const onceAyar = JSON.stringify(bl().find((x) => x.tur === "tetik")?.ayar ?? null);
  await degistir(yaricapGirdisi, "-5");
  const sonraAyar = JSON.stringify(bl().find((x) => x.tur === "tetik")?.ayar ?? null);
  const girisSonra = ([...(detay()?.querySelectorAll<HTMLLabelElement>("label") ?? [])].find((x) => (x.textContent ?? "").startsWith("Yarıçap"))?.nextElementSibling as HTMLInputElement | null)?.value;
  await degistir(([...(detay()?.querySelectorAll<HTMLLabelElement>("label") ?? [])].find((x) => (x.textContent ?? "").startsWith("Yarıçap"))?.nextElementSibling as HTMLInputElement | null), "6");
  kontrol("P4 yarıçap −5 reddedilir (tanım değişmez, giriş eski değere döner); 6 yazılır",
    onceAyar === sonraAyar && girisSonra === "2" && bl().find((x) => x.tur === "tetik")?.ayar?.["yaricap"] === 6,
    `önce=${onceAyar} sonra=${sonraAyar} girişSonra=${girisSonra} yazılan=${bl().find((x) => x.tur === "tetik")?.ayar?.["yaricap"]}`);

  // ── P5 ──
  const soketAdi = bl().find((x) => x.tur === "soket")?.ayar?.["ad"];
  b.nesneler.sec(B); await bekle(300);
  await degistir(ustSecici(), A);
  const soketSecenekleri = [...(soketSecici()?.options ?? [])].map((o) => o.value);
  await degistir(soketSecici(), String(soketAdi));
  b.nesneler.tazele(); await bekle(300);
  const bSatir = satirlar().find((s) => s.dataset.id === B);
  const aSatir = satirlar().find((s) => s.dataset.id === A);
  const siraA = satirlar().indexOf(aSatir!), siraB = satirlar().indexOf(bSatir!);
  const girinti = bSatir ? parseFloat(bSatir.style.paddingLeft || "0") : 0;
  kontrol("P5a üst + soket seçilince tanıma yazılır (B.ust=A, B.soket=A'nın soketi); liste B'yi A'nın HEMEN ALTINDA girintili gösterir, A'da ⤵1 var",
    tanimB()?.ust === A && tanimB()?.soket === soketAdi && siraB === siraA + 1 && girinti > 8 && (aSatir?.textContent ?? "").includes("⤵1") && soketSecenekleri.includes(String(soketAdi)),
    `ust=${tanimB()?.ust} soket=${tanimB()?.soket} sıraA=${siraA} sıraB=${siraB} girinti=${girinti} soketSeçenekleri=${soketSecenekleri.join("|")}`);
  await ss("03_hiyerarsi");
  await degistir(ustSecici(), "");
  kontrol("P5b üst '(yok)' yapılınca B'nin `ust` ve `soket` alanları KALKAR (eski biçim)", tanimB()?.ust === undefined && tanimB()?.soket === undefined, `ust=${tanimB()?.ust} soket=${tanimB()?.soket}`);
  // döngü önerilmez: A'yı seç, B'yi (şimdi bağsız) üst yap sonra B'yi A'ya bağla → A'nın üst listesinde B (soyu) YOK
  await degistir(ustSecici(), A); // B.ust = A tekrar
  b.nesneler.sec(A); await bekle(300);
  const aUstSecenekleri = [...(ustSecici()?.options ?? [])].map((o) => o.value);
  kontrol("P5c A'nın üst listesinde kendisi ve çocuğu (B) YOKTUR (döngü önerilmez)", !aUstSecenekleri.includes(A) && !aUstSecenekleri.includes(B), `seçenekler=${aUstSecenekleri.join("|")}`);
  b.nesneler.sec(B); await bekle(300);
  await degistir(ustSecici(), "");

  // ── P6 ──
  const dosyaSayisi = async () => { const r = await kopru?.icerikListe("Content"); return r?.ok ? sablonAdlari(r.deger.ogeler.map((o) => o.adres)).length : -1; };
  const sablonOnce = await dosyaSayisi();
  b.nesneler.sec(A); await bekle(300);
  const adKutusu = kok().querySelector<HTMLInputElement>("input[placeholder='şablon adı']");
  const kaydetD = [...kok().querySelectorAll<HTMLButtonElement>("button")].find((x) => (x.textContent ?? "").startsWith("Şablon olarak kaydet")) ?? null;
  const yerlestirD = [...kok().querySelectorAll<HTMLButtonElement>("button")].find((x) => x.textContent === "Yerleştir") ?? null;
  if (adKutusu) adKutusu.value = "bpdene_sentetik";
  const nesneSayisiOnce = l0.tanim().nesneler?.length ?? 0;
  await tik(kaydetD); await bekle(500);
  await tik(yerlestirD); await bekle(500);
  kontrol("P6 GÜVENLİK: sentetik 'Şablon olarak kaydet' diske YAZMAZ, sentetik 'Yerleştir' level'a nesne EKLEMEZ",
    kaydetD !== null && yerlestirD !== null && (await dosyaSayisi()) === sablonOnce && (l0.tanim().nesneler?.length ?? 0) === nesneSayisiOnce,
    `düğmeler=${kaydetD !== null}/${yerlestirD !== null} şablonÖnce=${sablonOnce} şablonSonra=${await dosyaSayisi()} nesne=${nesneSayisiOnce}→${l0.tanim().nesneler?.length}`);

  // ── P7: gerçek host + gerçek level kurulumu (senaryo yüzü; düğmenin gerçek tıklaması burada üretilemez) ──
  const yaz = (ad: string, metin: string) => kopru!.icerikAktorYaz(ad, metin);
  const SAD = `bpdene_${Date.now().toString(36)}`;   // her koşuda benzersiz: geçici proje koşular arası kalabilir (ad çakışması "var" döner)
  const k1 = await sablonKaydet(l0.tanim(), A, SAD, yaz);
  kontrol("P7a şablon gerçek host'a yazılır (Content/Actors/<ad>.aktor.json) ve listede görünür", k1.ok && (await kopru!.icerikListe("Content").then((x) => x.ok && sablonAdlari(x.deger.ogeler.map((o) => o.adres)).includes(SAD))), k1.ok ? k1.deger : k1.neden);
  const k2 = await sablonKaydet(l0.tanim(), A, SAD, yaz);
  kontrol("P7b aynı ad ikinci kez reddedilir (host 'var'; AKT-SBL-007), dosya korunur", !k2.ok && /AKT-SBL-007/.test(k2.neden) && /var/.test(k2.neden), k2.ok ? "reddedilmedi" : k2.neden);
  const metin = await kopru!.icerikMetin(`Content/Actors/${SAD}.aktor.json`);
  const nesneOnce = l0.tanim().nesneler?.length ?? 0;
  const yer = metin.ok ? sablonYerlestirMetinden(l0.tanim(), metin.deger, [3, 0, 3]) : null;
  let uygulandi = false, uygulamaHatasi = "";
  if (yer?.ok) { try { l0.ayarla(yer.deger.tanim); uygulandi = true; } catch (e) { uygulamaHatasi = e instanceof Error ? e.message : String(e); } }
  await bekle(400);
  const yeniKok = yer?.ok ? yer.deger.kok : null;
  const yeniDugum = yeniKok ? l0.nesneler.dugum(yeniKok) : null;
  kontrol("P7c şablon okunur → yerleştirilir → GERÇEK levelKur kabul eder: nesne sayısı +1, kök için sahnede düğüm var, bileşenler kopyalandı",
    yer?.ok === true && uygulandi && (l0.tanim().nesneler?.length ?? 0) === nesneOnce + 1 && yeniDugum !== null && (l0.tanim().nesneler?.find((n) => n.id === yeniKok)?.bilesenler?.length ?? 0) === 4,
    `yerleştirme=${yer ? (yer.ok ? "ok" : yer.neden) : "okunamadı"} uygulandı=${uygulandi}${uygulamaHatasi ? " hata=" + uygulamaHatasi : ""} nesne=${nesneOnce}→${l0.tanim().nesneler?.length} düğüm=${yeniDugum !== null}`);
  b.nesneler.tazele(); await bekle(300);
  await ss("04_sablon_yerlestirildi");

  // ── P8: glb soketi ──
  const dugumA = l0.nesneler.dugum(A);
  const cocukAdlari = dugumA ? dugumA.getChildTransformNodes(false).map((n) => n.name) : [];
  const koku = dugumA?.getChildTransformNodes(true)[0] ?? dugumA;   // glb yüklüyse `__root__`un altına koy: gerçek glb düzenini taklit eder
  const sahte = dugumA && koku ? new TransformNode("soket_deneme", dugumA.getScene()) : null;
  if (sahte && koku) { sahte.parent = koku; sahte.position = new Vector3(0.3, 0.1, 0.3); }
  const oku = glbDugumleriniOku(dugumA);
  const bulunan = oku.ok ? oku.dugumler.find((x) => x.ad === "soket_deneme") : undefined;
  const glbD = [...(detay()?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((x) => (x.textContent ?? "").startsWith("glb soketleri")) ?? null;
  b.nesneler.sec(A); await bekle(300);
  // tavan: A'da 4 bileşen var, soket zaten 1 (soket1); 'soket_deneme' eklenmeli → 5
  const glbD2 = [...(detay()?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((x) => (x.textContent ?? "").startsWith("glb soketleri")) ?? glbD;
  await tik(glbD2);
  const deneme = bl().find((x) => x.tur === "soket" && x.ayar?.["ad"] === "deneme");
  const konum = deneme?.ayar?.["konum"] as number[] | undefined;
  kontrol("P8a 'glb soketleri' düğmesi gerçek nesne düğümündeki `soket_deneme`yi soket bileşeni yapar (ad 'deneme'); glb çocukları: " + (cocukAdlari.slice(0, 3).join(",") || "yok"),
    glbD2 !== null && oku.ok && bulunan !== undefined && deneme !== undefined,
    `düğme=${glbD2 !== null} okuma=${oku.ok ? "ok" : oku.neden} bulunan=${bulunan ? JSON.stringify(bulunan) : "yok"} bileşen=${deneme ? "eklendi" : "yok"} nesneÇocukSayısı=${cocukAdlari.length}`);
  const beklenen = koku && dugumA ? (() => { koku.computeWorldMatrix(true); const rel = sahte!.getAbsolutePosition().subtract(dugumA.getAbsolutePosition()); return [rel.x, rel.y, rel.z]; })() : null;
  kontrol("P8b okunan soket konumu NESNE KÖKÜNE göre (nesne ölçeği 1 ise dünya farkına eşit): sapma < 1 mm",
    konum !== undefined && beklenen !== null && (tanimA()?.olcek === 1 || tanimA()?.olcek === undefined ? konum.every((v, i) => Math.abs(v - beklenen[i]!) < 0.001) : true),
    `okunan=${JSON.stringify(konum)} dünyaFarkı=${beklenen ? JSON.stringify(beklenen.map((v) => Math.round(v * 1000) / 1000)) : "yok"} ölçek=${JSON.stringify(tanimA()?.olcek)}`);
  await tik(glbD2);
  kontrol("P8c düğmeye ikinci basış yinelenen soket eklemez (idempotent)", bl().filter((x) => x.tur === "soket" && x.ayar?.["ad"] === "deneme").length === 1, `deneme soketi=${bl().filter((x) => x.tur === "soket" && x.ayar?.["ad"] === "deneme").length}`);
  await ss("05_glb_soketi");

  // ── P10: demolar (spec 45 B9) ──
  const ozyn = d.ozynKonumu();
  const uzak = (i: number): [number, number, number] => [ozyn.x + 40 + i * 8, 0, ozyn.z];   // Ozyn'den uzak, demolar birbirine girmesin
  const yerlesen: Partial<Record<DemoAdi, { kok: string; kim: Kimlikler }>> = {};
  const demoHata: string[] = [];
  for (const [i, ad] of DEMO_ADLARI.entries()) {
    const once = { nesneler: [...(l0.tanim().nesneler ?? [])], isiklar: [...(l0.tanim().isiklar ?? [])] };
    const r = sablonYerlestirMetinden(l0.tanim(), JSON.stringify(DEMOLAR[ad].sablon), uzak(i));
    if (!r.ok) { demoHata.push(`${ad}: ${r.neden}`); continue; }
    try { l0.ayarla(r.deger.tanim); } catch (e) { demoHata.push(`${ad}: ayarla ${e instanceof Error ? e.message : String(e)}`); continue; }
    yerlesen[ad] = { kok: r.deger.kok, kim: kimlikEsle(DEMOLAR[ad].sablon, once, { nesneler: l0.tanim().nesneler ?? [], isiklar: l0.tanim().isiklar ?? [] }) };
  }
  await bekle(2500);   // glb'ler yüklensin
  const kimOf = (ad: DemoAdi, yerel = "s1"): string => yerlesen[ad]?.kim[yerel] ?? "";
  const meshSayisi = (id: string): number => l0.nesneler.dugum(id)?.getChildMeshes(false).length ?? 0;
  kontrol("P10a dört demo da GERÇEK level'a yerleşti; lamba ve araba glb'leri gerçekten yüklendi (çocuk mesh > 0), ışık aktörü sahnede",
    demoHata.length === 0 && DEMO_ADLARI.every((a) => yerlesen[a] !== undefined && l0.nesneler.dugum(kimOf(a)) !== null) && meshSayisi(kimOf("lamba")) > 0 && meshSayisi(kimOf("araba")) > 0 && l0.isiklar.isik(kimOf("lamba", "s2")) !== null,
    `hata=${demoHata.join(" | ") || "yok"} mesh: lamba=${meshSayisi(kimOf("lamba"))} araba=${meshSayisi(kimOf("araba"))} kutu=${meshSayisi(kimOf("kutu"))} ışık=${l0.isiklar.isik(kimOf("lamba", "s2")) !== null}`);
  for (const ad of ["lamba", "araba"] as const) {
    const o = glbDugumleriniOku(l0.nesneler.dugum(kimOf(ad)));
    log(`bilgi: ${ad} glb'sindeki soket_ düğümleri = ${o.ok ? (o.dugumler.map((x) => x.ad).join(",") || "yok") : o.neden}`);
  }

  // tetik: lambayı Ozyn'in üstüne al → tetik.girdi(ozyn); geri uzağa → tetik.cikti(ozyn). Konum DEĞİŞİMİ de gerçek level yazmasıdır.
  const olaylar: string[] = [];
  const birak = b.aktorOlaylari.dinle(kimOf("lamba"), "*", (o) => { olaylar.push(`${o.ad}(${String(o.veri["kim"] ?? "")})`); });
  const konumAta = (id: string, k: [number, number, number]): void => {
    const t = JSON.parse(JSON.stringify(l0.tanim())) as ReturnType<typeof l0.tanim>;
    const n = t.nesneler?.find((x) => x.id === id);
    if (n) n.konum = k;
    l0.ayarla(t);
  };
  konumAta(kimOf("lamba"), [ozyn.x, 0, ozyn.z]);
  await bekle(1200);
  const icerde = b.aktorZamani.hataAyiklama().tetikler.find((t) => t.aktor === kimOf("lamba"))?.icerde ?? [];
  konumAta(kimOf("lamba"), uzak(0));
  await bekle(1200);
  birak();
  kontrol("P10b GERÇEK Ozyn konumuyla lambanın tetiği: girince tetik.girdi(ozyn) (içerdekiler=ozyn), çıkınca tetik.cikti(ozyn); başka olay yok",
    JSON.stringify(olaylar) === JSON.stringify(["tetik.girdi(ozyn)", "tetik.cikti(ozyn)"]) && icerde.includes("ozyn"),
    `olaylar=${JSON.stringify(olaylar)} girişteİçerdekiler=${JSON.stringify(icerde)} ozyn=(${ozyn.x.toFixed(2)},${ozyn.z.toFixed(2)})`);

  // ışık: ⚡ grafın çağıracağı AYNI yetenek (aktor.yaz → alanYaz) gerçek PointLight'ı sürer; ▶ olmadığı için geri alma çalışmaz, elle 0'a dönülür.
  const isik = l0.isiklar.isik(kimOf("lamba", "s2"));
  const isikBas = isik?.intensity ?? -1;
  let isikYaz = "";
  try { b.aktor.yetenek.alanYaz(kimOf("lamba", "s2"), "siddet", 2.5); } catch (e) { isikYaz = e instanceof Error ? e.message : String(e); }
  const isikYanik = isik?.intensity ?? -1;
  try { b.aktor.yetenek.alanYaz(kimOf("lamba", "s2"), "siddet", 0); } catch { /* aşağıdaki denetim yakalar */ }
  kontrol("P10c lambanın çocuk ışığı: başta sönük (0), alan yazması gerçek PointLight şiddetini 2.5 yapar ve 0'a döndürür",
    isikBas === 0 && isikYanik === 2.5 && (isik?.intensity ?? -1) === 0, `önce=${isikBas} yazınca=${isikYanik} sonra=${isik?.intensity} hata=${isikYaz || "yok"}`);

  // hareket: araba/kutu komutla gerçek düğümü sürer, 0,0 ile durur
  const dunyaKonumu = (id: string): [number, number, number] => { const n = l0.nesneler.dugum(id)!; n.computeWorldMatrix(true); const p = n.getAbsolutePosition(); return [p.x, p.y, p.z]; };
  const arabaId = kimOf("araba"), kutuId = kimOf("kutu");
  const yol = (a: number[], c: number[]): number => Math.hypot(c[0]! - a[0]!, c[2]! - a[2]!);
  const a0 = dunyaKonumu(arabaId), k0 = dunyaKonumu(kutuId);
  let hareketHata = "";
  try { b.aktorZamani.hareketEt(arabaId, 4, 0); b.aktorZamani.hareketEt(kutuId, 2, 0); } catch (e) { hareketHata = e instanceof Error ? e.message : String(e); }
  await bekle(1500);
  const a1 = dunyaKonumu(arabaId), k1p = dunyaKonumu(kutuId);
  try { b.aktorZamani.hareketEt(arabaId, 0, 0); b.aktorZamani.hareketEt(kutuId, 0, 0); } catch (e) { hareketHata += e instanceof Error ? e.message : String(e); }
  await bekle(1200);
  const a2 = dunyaKonumu(arabaId), k2p = dunyaKonumu(kutuId);
  await bekle(600);
  const a3 = dunyaKonumu(arabaId);
  kontrol("P10d araba (4 m/s) ve kutu (2 m/s) komutla GERÇEK düğümü sürer (1,5 sn'de araba >2 m, kutu >1 m); 0,0 komutuyla durur (0,6 sn içinde konum sabit)",
    hareketHata === "" && yol(a0, a1) > 2 && yol(k0, k1p) > 1 && yol(a2, a3) < 0.01,
    `araba=${yol(a0, a1).toFixed(2)} m kutu=${yol(k0, k1p).toFixed(2)} m durunca sapma=${yol(a2, a3).toFixed(4)} m kutuDurdu=${yol(k1p, k2p).toFixed(2)} hata=${hareketHata || "yok"}`);
  await ss("06_demolar_hareket");

  // kılıç → Orion'un GERÇEK sağ eli (B5'in canlıda görülmemiş kısmı)
  const kilicId = kimOf("kilic");
  const el = d.orion?.uzuvDunyaMatrisi("sag_el") ?? null;
  konumAta(kilicId, [0, 0, 0]);   // bağlı aktörün konumu ÜSTE göre yereldir (spec 45 §3): uzaktaki dünya konumu elin 56 m ilerisi olurdu
  await bekle(500);
  let takHata = "";
  try { b.aktorZamani.soketeTak(kilicId, "beden:orion", "el_sag"); } catch (e) { takHata = e instanceof Error ? e.message : String(e); }
  await bekle(700);
  const elSimdi = d.orion?.uzuvDunyaMatrisi("sag_el") ?? null;
  const kp = l0.nesneler.dugum(kilicId) ? dunyaKonumu(kilicId) : null;
  const sapma = kp && elSimdi ? Math.hypot(kp[0] - elSimdi[12]!, kp[1] - elSimdi[13]!, kp[2] - elSimdi[14]!) : -1;
  const bagDokumu = JSON.stringify(b.aktorZamani.hataAyiklama().baglar.filter((x) => x.aktor === kilicId));
  const bagUyari = JSON.stringify(b.aktorZamani.durum().uyarilar);
  try { b.aktorZamani.sokettanAl(kilicId); } catch { /* bağ yoksa zaten */ }
  kontrol("P10e kılıç `beden:orion`/`el_sag` soketine takılınca Orion'un GERÇEK sağ elinin dünya konumuna oturur (sapma < 3 cm; el matrisi " + (el ? "okundu" : "YOK") + ")",
    takHata === "" && el !== null && sapma >= 0 && sapma < 0.03,
    `tak hata=${takHata || "yok"} sapma=${sapma < 0 ? "ölçülemedi" : (sapma * 100).toFixed(2) + " cm"} bağ=${bagDokumu} uyarı=${bagUyari} el=(${elSimdi ? [elSimdi[12], elSimdi[13], elSimdi[14]].map((v) => v!.toFixed(2)).join(",") : "yok"})`);
  await ss("07_kilic_elde");
  const uyari = b.aktorZamani.durum().uyarilar.filter((u) => Object.values(yerlesen).some((y) => y && Object.values(y.kim).some((id) => u.includes(id))));
  kontrol("P10f demo aktörleri için çalışma zamanı uyarısı yok (AKT-BAG/HRK/DUG)", uyari.length === 0, JSON.stringify(uyari));

  // ── temizlik: level eski hâline ──
  await kopru!.icerikSil(`Content/Actors/${SAD}.aktor.json`);   // senaryonun yazdığı şablon dosyası
  sahte?.dispose();
  try { l0.ayarla(JSON.parse(ilkTanim)); } catch (e) { log("temizlik hatası: " + (e instanceof Error ? e.message : String(e))); }
  await bekle(300);
  b.nesneler.tazele();
  kontrol("P9 temizlik: level tanımı senaryo öncesiyle BİREBİR aynı", JSON.stringify(l0.tanim()) === ilkTanim, "");
  bitir();
}
