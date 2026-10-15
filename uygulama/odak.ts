// uygulama/odak.ts — Odak/zoom kipi: monitöre ve panellere geçiş, zoom kumandası, odakta tıklama ve imleç ipucu.
//
// Eskiden uygulama/giris.ts'in ortasındaydı (mimari düzenleme B1–B2). `odakMesh`, `odakliYuzey`, `zoomPayi`,
// `sonVurgu`, `vurguSaat` yalnız bu parçaların ortak durumu: kapanışa girdi; dışarıya yalnız aşağıdaki
// eylemler ve okuyucular çıkar. Dinleyiciler (zoom düğmeleri, tekerlek, fare hareketi, tıklama) `odakKur`
// çağrıldığı anda takılır — giris.ts'te eski yerleriyle aynı noktada.
"use strict";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Engine } from "@babylonjs/core/Engines/engine";
import type { Scene } from "@babylonjs/core/scene";
import type { KameraRig } from "../world/engine/kamera.ts";
import type { OdaKurulumu } from "../world/level/oda.ts";
import { capaBul, type Capa } from "../world/level/capalar.ts";
import type { Monitor } from "../world/surfaces/terminal/monitor.ts";
import type { SemaPaneli } from "../world/surfaces/duvar/sema.ts";
import type { GunlukEkrani } from "../world/surfaces/duvar/gunluk.ts";
import type { WebMonitoru } from "./webMonitoru.ts";

export interface OdakGirdisi {
  motor: Engine;
  sahne: Scene;
  rig: KameraRig;
  oda: OdaKurulumu;
  monitor: Monitor;
  adminTerminal: Monitor;
  sema: SemaPaneli;
  gunluk: GunlukEkrani;
  tuval: HTMLCanvasElement;
  altyaziGoster: (metin: string, ms?: number) => void;
  /** Ozyn'in şu anki yerinin çapaları (yer değişince değişir: çağrı anında okunur). */
  ozynCapalari: () => readonly Capa[];
  /** Ofisteki 3. monitör (groma haritası, uygulama/webMonitoru.ts): odaktayken fare/tekerlek sayfaya iletilir. Verilmezse groma odağı yalnız kamera. */
  webMonitoru?: WebMonitoru;
}

export interface Odak {
  monitoreGec(): Promise<void>;
  admineGec(): Promise<void>;
  admindenCik(): void;
  monitordenCik(): void;
  panelOdak(mesh: AbstractMesh, etiket: string): void;
  zoomUygula(yenidenCerceveleme?: boolean): void;
  /** Tıklanabilir yüzeyler ve oraya nasıl geçileceği (anahtar: çapa adı). */
  readonly yuzeyGecisi: Record<string, () => void | Promise<void>>;
  zoomPayi(): number;
  /** Odaktan çıkışın tek gözetim noktası: odak düştüyse zoom kumandasını ve açık detayı kapatır (HUD aralığı çağırır). */
  odakDustuyseTemizle(): void;
}

export function odakKur(girdi: OdakGirdisi): Odak {
  const { motor, sahne, rig, oda, monitor, adminTerminal, sema, gunluk, tuval, altyaziGoster } = girdi;
  const web = girdi.webMonitoru;
  const zoomKutu = document.getElementById("zoom") as HTMLElement;
  const zoomOran = document.getElementById("zoomOran") as HTMLElement;
  /**
   * Monitöre geçiş.
   *
   * Kamerayı ekrana YAKLAŞTIRIYORUZ çünkü ölçüldü: 1.5 m'den 80×24 terminal
   * hücre başına 4.4 piksel düşüyor ve okunmuyor — bu fiziksel bir sınır,
   * gerçek hayatta da okunmaz. ~0.6 m'de hücre başına ~11 piksel, rahat okunur.
   */
  async function monitoreGec(): Promise<void> {
    adminTerminal.odaklan(false);   // iki terminale birden yazılmaz
    // Terminallerde zoom YOK: 0.95 m okunabilirlik için ÖLÇÜLDÜ (1.5 m'de
    // hücre başına 4.4 piksel, okunmuyor; 0.6 m'de ~11 piksel). Genel
    // çerçeveleme hesabıyla ezmek o ölçümü çöpe atardı.
    odakMesh = null; odakliYuzey = "monitor"; zoomUygula(false);
    const ekranNoktasi = oda.monitorEkran.getAbsolutePosition();
    // Odak kipi (sinematik DEĞİL): fare oynayınca bozulmaz, yalnızca Esc çözer.
    // 0.95 m: 0.62'de ekran çerçeveyi taşıyordu, bütün ekran görünsün.
    rig.odakKilitle(ekranNoktasi, 0.95, 0.05);
    if (!monitor.acikMi()) {
      try { await monitor.ac(); }
      catch (e) { console.error("[monitor] açılamadı:", e); altyaziGoster("terminal açılamadı"); return; }
    }
    monitor.odaklan(true);
    altyaziGoster("terminal açık — `claude` yazabilirsin · Esc ile çık", 3200);
  }

  /**
   * Yönetim terminaline geçiş.
   *
   * Monitörle aynı desen ama AYRI: ikisi farklı pty, farklı kamera hedefi ve
   * farklı amaç. Aynı anda ikisine birden odaklanmak anlamsız olurdu, bu yüzden
   * biri açılırken diğerinin odağı bırakılır.
   */
  async function admineGec(): Promise<void> {
    monitor.odaklan(false);
    odakMesh = null; odakliYuzey = "admin"; zoomUygula(false);   // bkz. monitoreGec: mesafe ölçülmüş
    // Ekranın KENDİ normali boyunca konumlan: admin monitörü masada açılı.
    // CreatePlane'in varsayılan normali -Z olduğu için yön oradan türetilir.
    const yon = oda.adminEkran.getDirection(new Vector3(0, 0, -1));
    // 0.85 m: 0.62'de ekran çerçeveyi taşıyordu (ölçüm: ekran görüntüsü).
    rig.odakKilitle(oda.adminEkran.getAbsolutePosition(), 0.85, 0.04, yon);
    if (!adminTerminal.acikMi()) {
      try { await adminTerminal.ac(); }
      catch (e) {
        console.error("[admin] açılamadı:", e);
        altyaziGoster("yönetim terminali açılamadı");
        gunluk.ekle("hata", "admin", `terminal açılamadı: ${e instanceof Error ? e.message : e}`);
        return;
      }
      gunluk.ekle("bilgi", "admin", "yönetim terminali açıldı");
    }
    adminTerminal.odaklan(true);
    altyaziGoster("yönetim terminali — Orion burayı GÖRMÜYOR · Esc ile çık", 3200);
  }

  function admindenCik(): void {
    adminTerminal.odaklan(false);
    rig.odakBirak();
  }

  // ── ODAKTA TIKLAMA: yüzeyler arası geçiş ──────────────────────────────────
  //
  // İstek: "terminale veya ofisteki bir panele gelince mouse kullanılabilir,
  // objeleri seçebilir, düzgün bir kullanıma dönüşecek."
  //
  // Odaktayken imleç zaten serbest (bkz. kamera.ts fare kipi). Burada o imlece
  // işlev veriliyor: bir yüzeye tıklamak oraya geçirir — masaüstünde pencereler
  // arasında tıklamak gibi. Odaktan çıkmadan ekranlar arasında dolaşabilirsin.
  //
  // GEZİNİRKEN bu çalışmaz: orada tıklamanın işi kamerayı ele almak ve yüzeye
  // `E` ile yaklaşılır. İki kipte tek tuşa iki anlam yüklemek karışıklık olurdu.

  /** Tıklanabilir yüzeyler ve oraya nasıl geçileceği. */
  const YUZEY_GECISI: Record<string, () => void | Promise<void>> = {
    monitor: () => monitoreGec(),
    admin: () => admineGec(),
    sema: () => panelOdak(oda.semaYuzey, "beyin şeması"),
    gunluk: () => panelOdak(oda.gunlukYuzey, "beyin günlüğü"),
    tahta: () => panelOdak(oda.tahtaYuzey, "beyaz tahta"),
    groma: () => panelOdak(oda.gromaEkran, "groma haritası"),
  };

  /**
   * Salt-okunur bir panele odaklan (şema, günlük, tahta).
   *
   * Terminallerden farklı: klavye girişi yok, yalnızca kamera. Yüzeyin KENDİ
   * normali kullanılır — duvara asılı paneller için "oda ortasına doğru"
   * varsayımı yanlış çerçeveliyordu (yönetim terminalinde ölçülmüştü).
   */
  /**
   * Yüzeyin TAMAMININ çerçeveye sığacağı kamera mesafesi.
   *
   * Sabit mesafe yanlıştı: 1.15 m'de görünen dikey alan 1.11 m, oysa zihin
   * duvarı panelleri 1.35 m — tablo çerçeveyi taşıyordu ve alt/üstü kesiliyordu
   * (Ozyn bildirdi, hesapla doğrulandı).
   *
   * Artık mesafe geometriden türüyor: dikey görüş alanı `2·d·tan(fov/2)`, bunu
   * yüzey yüksekliğine eşitleyip %15 pay bırakıyoruz. Böylece kural her panel
   * boyutunda kendiliğinden doğru — yeni bir yüzey eklendiğinde sayı ayarlamak
   * gerekmiyor.
   */
  function cerceveMesafesi(mesh: AbstractMesh, pay = 1.15): number {
    const k = mesh.getBoundingInfo().boundingBox.extendSize;
    const o = mesh.absoluteScaling;
    const yukseklik = Math.max(0.1, k.y * 2 * Math.abs(o.y));
    const genislik = Math.max(0.1, k.x * 2 * Math.abs(o.x));

    const dikeyFov = rig.kamera.fov;
    const enBoy = Math.max(0.5, motor.getRenderWidth() / Math.max(1, motor.getRenderHeight()));

    // İki kısıt: yükseklik dikey FOV'a, genişlik yatay FOV'a sığmalı.
    // Hangisi daha uzak mesafe istiyorsa o kazanır.
    const dikeyIcin = (yukseklik * pay) / (2 * Math.tan(dikeyFov / 2));
    const yatayIcin = (genislik * pay) / (2 * Math.tan(dikeyFov / 2) * enBoy);
    return Math.max(dikeyIcin, yatayIcin);
  }

  // ── ZOOM — odaktaki yüzeyi ne kadar yakından çerçeveliyoruz ───────────────
  //
  // `cerceveMesafesi`'nin `pay` çarpanı zaten "yüzeyin etrafında ne kadar boşluk
  // kalsın" demek: 1.0 = tam sığar, büyüdükçe uzaklaşır. Zoom bu tek sayıyı
  // oynatıyor — FOV'a dokunmuyoruz çünkü FOV değiştirmek perspektifi bozar
  // (dolly ile zoom farkı), oysa burada istenen şey kameranın geri çekilmesi.
  //
  // Aralık ölçümle değil geometriyle seçildi: 0.70'te panel çerçeveyi taşar
  // (kırpma kasıtlı, detaya bakmak için), 3.0'da oda bağlamıyla birlikte görünür.
  const ZOOM_EN_YAKIN = 0.70;
  const ZOOM_EN_UZAK = 3.00;
  const ZOOM_ADIM = 0.15;
  const ZOOM_VARSAYILAN = 1.15;

  let zoomPayi = ZOOM_VARSAYILAN;
  /** Odaklanılan mesh — zoom değişince yeniden çerçevelemek için saklanır. */
  let odakMesh: AbstractMesh | null = null;
  /**
   * ODAKTAKİ yüzeyin çapa adı. Tıklamanın anlamını belirler:
   *
   *   uzaktaki yüzeye tıkla  → o yüzeye GEÇ
   *   odaktaki yüzeye tıkla  → o yüzeyin İÇİNE tıkla
   *
   * Bu ayrım olmadan odaktaki panele her tıklayış `panelOdak`u yeniden
   * çağırıyordu: zoom sıfırlanıyor ve tıklama hiçbir şey seçmiyordu.
   */
  let odakliYuzey: string | null = null;
  const zoomYakinDugme = document.getElementById("zoomYakin") as HTMLButtonElement;
  const zoomUzakDugme = document.getElementById("zoomUzak") as HTMLButtonElement;

  /** Kumandayı ve kamerayı güncel zoom'a göre tazeler. */
  function zoomUygula(yenidenCerceveleme = true): void {
    const acik = odakMesh !== null;
    zoomKutu.dataset.acik = acik ? "1" : "0";
    if (!acik) return;

    // %100 = varsayılan çerçeveleme. Kullanıcı "1.15 pay" değil "%100" görür.
    zoomOran.textContent = `%${Math.round((ZOOM_VARSAYILAN / zoomPayi) * 100)}`;
    zoomYakinDugme.disabled = zoomPayi <= ZOOM_EN_YAKIN + 1e-6;
    zoomUzakDugme.disabled = zoomPayi >= ZOOM_EN_UZAK - 1e-6;

    if (!yenidenCerceveleme || !odakMesh) return;
    // `odakKilitle` mutlak konum saklıyor; yeniden çağırmak dolly'yi başlatır
    // ve kamera zaten hedefe lerp'lediği için geçiş bedavaya yumuşak olur.
    const yon = odakMesh.getDirection(new Vector3(0, 0, -1));
    rig.odakKilitle(odakMesh.getAbsolutePosition(), cerceveMesafesi(odakMesh, zoomPayi), 0.02, yon);
  }

  function zoomDegistir(delta: number): void {
    if (!odakMesh) return;
    const yeni = Math.max(ZOOM_EN_YAKIN, Math.min(ZOOM_EN_UZAK, zoomPayi + delta));
    if (Math.abs(yeni - zoomPayi) < 1e-6) return;   // uçta: sessizce hiçbir şey yapma
    zoomPayi = yeni;
    zoomUygula();
  }

  zoomYakinDugme.addEventListener("click", () => zoomDegistir(-ZOOM_ADIM));
  zoomUzakDugme.addEventListener("click", () => zoomDegistir(+ZOOM_ADIM));

  // Tekerlek: düğmeler keşfedilebilirlik için, tekerlek hız için.
  // Yalnızca odakta çalışır — gezinirken tekerleğin başka bir anlamı yok.
  tuval.addEventListener("wheel", (e) => {
    if (!odakMesh) return;
    // 3. monitörde (groma haritası) tekerlek SAYFAYA gider (haritayı yakınlaştırır); kamera yakınlığı +/− düğmelerinde kalır.
    if (odakliYuzey === "groma" && web) {
      const k = gromaUV(e);
      if (k) { e.preventDefault(); web.tekerlek(k.u, k.v, e.deltaY, e.deltaX); return; }
    }
    e.preventDefault();
    zoomDegistir(e.deltaY > 0 ? +ZOOM_ADIM : -ZOOM_ADIM);
  }, { passive: false });

  function panelOdak(mesh: AbstractMesh, etiket: string): void {
    monitor.odaklan(false);
    adminTerminal.odaklan(false);
    // CreatePlane'in yüzey normali -Z; mesh döndürülmüş olsa da bu doğru yönü verir.
    odakMesh = mesh;
    odakliYuzey = (mesh.metadata as { capa?: string } | undefined)?.capa ?? null;
    zoomPayi = ZOOM_VARSAYILAN;        // her yeni panelde temiz başla
    zoomUygula();                      // kamerayı da kurar
    altyaziGoster(`${etiket} — fare serbest, tıklayabilirsin · Esc ile çık`, 3000);
  }

  // Tıklanabilirlik GÖRÜNÜR olmalı: gizli davranış "düzgün kullanım" değildir.
  // Odaktayken imlecin altındaki yüzey tıklanabilirse imleç `pointer` olur ve
  // hangi yüzey olduğu altyazıda yazar. Gezinirken bu hiç çalışmaz — orada
  // imleç zaten kilitli ve tıklamanın işi kamerayı ele almak.
  let sonVurgu: string | null = null;
  let vurguSaat = 0;

  /** Odaktaki yüzeyin İÇİNDE imlecin altında tıklanacak ne var — yüzey söyler. */
  const YUZEY_HEDEF: Record<string, (u: number, v: number) => string | null> = {
    sema: (u, v) => sema.hedef(u, v),
    // Groma haritası: ekranın her yeri sayfadır (tıklanabilirliği sayfa bilir) — imleç `pointer`.
    groma: () => "harita",
  };

  tuval.addEventListener("mousemove", (e) => {
    if (!rig.odakta) {
      if (sonVurgu) { tuval.style.cursor = ""; sonVurgu = null; }
      return;
    }
    // Işın testi her fare olayında değil, ~60 ms'de bir: fare olayları 100+ Hz
    // gelebiliyor ve her birinde 60 mesh taramak boşa iş.
    const simdi = performance.now();
    if (simdi - vurguSaat < 60) return;
    vurguSaat = simdi;

    const p = sahne.pick(e.offsetX, e.offsetY);
    const capa = (p?.pickedMesh?.metadata as { capa?: string } | undefined)?.capa;

    // ODAKTAKİ yüzeyin içi: imleç kutunun üstündeyken `pointer`, boşlukta değil.
    // Devre panosunda "neresi tıklanabilir" denemeyle öğrenilmemeli.
    if (capa && capa === odakliYuzey) {
      const uv = p?.getTextureCoordinates?.();
      const hedef = uv ? (YUZEY_HEDEF[capa]?.(uv.x, uv.y) ?? null) : null;
      const anahtar = hedef ? `${capa}:${hedef}` : null;
      if (anahtar === sonVurgu) return;
      sonVurgu = anahtar;
      tuval.style.cursor = hedef ? "pointer" : "";
      return;
    }

    const tiklanabilir = capa && capa in YUZEY_GECISI ? capa : null;
    if (tiklanabilir === sonVurgu) return;

    sonVurgu = tiklanabilir;
    tuval.style.cursor = tiklanabilir ? "pointer" : "";
    if (tiklanabilir) {
      const c = capaBul(tiklanabilir, girdi.ozynCapalari());
      altyaziGoster(`${c?.etiket ?? tiklanabilir} — tıkla`, 1600);
    }
  });

  /**
   * Odaktaki yüzeyin İÇİNE tıklama. Dönüş: tıklama tüketildi mi.
   *
   * UV doğrudan yüzeye geçirilir; piksele çevirmek burada YAPILMAZ. Çözünürlük
   * (`dikeyPiksel`) yüzeyin kendi bilgisi — dışarı sızsaydı değiştiği gün
   * tıklamalar sessizce kayardı.
   */
  const YUZEY_TIKLAMA: Record<string, (u: number, v: number) => boolean> = {
    sema: (u, v) => sema.tikla(u, v),
  };

  tuval.addEventListener("click", (e) => {
    // Gezinirken tıklama kamerayı ele alır (kamera.ts); burası yalnızca odak kipi.
    if (!rig.odakta) return;
    const p = sahne.pick(e.offsetX, e.offsetY);
    const capa = (p?.pickedMesh?.metadata as { capa?: string } | undefined)?.capa;
    if (!capa) return;

    // ZATEN odaktaki yüzey: tıklama geçiş değil, içerik tıklamasıdır.
    if (capa === odakliYuzey) {
      const uv = p?.getTextureCoordinates?.();
      if (!uv) return;
      const ele = YUZEY_TIKLAMA[capa];
      if (!ele) return;                       // içi tıklanabilir değil: sessiz
      const tuketildi = ele(uv.x, uv.y);
      console.log(`[TIKLAMA] ${capa} içi uv=${uv.x.toFixed(3)},${uv.y.toFixed(3)} tüketildi=${tuketildi}`);
      return;                                 // geçişi TEKRAR çalıştırma: zoom sıfırlanırdı
    }

    const gec = YUZEY_GECISI[capa];
    if (!gec) return;
    console.log(`[TIKLAMA] ${capa} yuzeyine geciliyor`);
    void gec();
  });

  // ── 3. MONİTÖR (groma haritası): odaktayken fare olayları sayfaya gider (haritada gezin, yakınlaştır, tıkla) ──────
  // Klavye iletilmez. Koordinat doku UV'sidir; sayfa pikseline `host/webMonitor.js` çevirir.
  function gromaUV(e: MouseEvent): { u: number; v: number } | null {
    if (!web || odakliYuzey !== "groma" || !rig.odakta) return null;
    const p = sahne.pick(e.offsetX, e.offsetY);
    if ((p?.pickedMesh?.metadata as { capa?: string } | undefined)?.capa !== "groma") return null;
    const uv = p?.getTextureCoordinates?.();
    return uv ? { u: uv.x, v: uv.y } : null;
  }
  const fareDugmesi = (e: MouseEvent) => (e.button === 2 ? "right" : e.button === 1 ? "middle" : "left") as "left" | "right" | "middle";
  tuval.addEventListener("mousedown", (e) => { const k = gromaUV(e); if (k) web!.bas(k.u, k.v, fareDugmesi(e)); });
  tuval.addEventListener("mouseup", (e) => { const k = gromaUV(e); if (k) web!.birak(k.u, k.v, fareDugmesi(e)); });
  let gromaHareketSaati = 0;
  tuval.addEventListener("mousemove", (e) => {
    if (!web || odakliYuzey !== "groma") return;
    const t = performance.now();
    if (t - gromaHareketSaati < 40) return;   // fare 100+ Hz gelebilir; sayfaya ve ışın testine ~25 Hz yeter
    gromaHareketSaati = t;
    const k = gromaUV(e);
    if (k) web.hareket(k.u, k.v);
  });

  /** Esc: klavye dünyaya döner, kamera serbest kalır. Terminal AÇIK kalır —
   *  çalışan bir claude oturumu masadan kalkınca ölmemeli. */
  function monitordenCik(): void {
    monitor.odaklan(false);
    rig.odakBirak();
  }

  return {
    monitoreGec, admineGec, admindenCik, monitordenCik, panelOdak, zoomUygula,
    yuzeyGecisi: YUZEY_GECISI,
    zoomPayi: () => zoomPayi,
    odakDustuyseTemizle() {
      if (!rig.odakta && (odakMesh || odakliYuzey)) {
        odakMesh = null; odakliYuzey = null;
        // Panelden çıkarken detay da kapanır: geri dönüldüğünde şema karşılar.
        // Açık bırakmak "panel bozulmuş" gibi okunurdu — kullanıcı o detayı
        // seçtiğini çoktan unutmuş olur.
        sema.sec(null);
        zoomUygula(false);
      }
    },
  };
}
