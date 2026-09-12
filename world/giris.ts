// world/giris.ts — Renderer giriş noktası ve BİRLEŞTİRME NOKTASI.
//
// Burada iş mantığı yoktur; parçalar birbirine bağlanır:
//   motor + sahne + saat (20Hz) + oda + kamera rig'i + oyuncu + HUD.
//
// İKİ DÖNGÜ AYRIMI (kritik, K1/K2):
//   saat.dinle(...)      → MANTIK. 20Hz sabit. Oyuncu hareketi, çarpışma,
//                          etkileşim taraması, kamera HEDEF pozu.
//   runRenderLoop(...)   → ÇİZİM. Serbest FPS. Yalnızca saati ilerletir,
//                          kamerayı hedefe yumuşatır ve sahneyi çizer.
// Mantık asla render döngüsünde çalışmaz; yoksa Orion'un davranışı donanıma
// göre değişir ve tekrarlanabilirlik ölür.
//
// K4 VE BU DOSYA: `world/` ALTINDAKİ MODÜLLER `bridge/`, `mind/`, `voice/`
// import edemez — kural onlar için. Burası birleştirme noktasıdır (composition
// root): katmanları BİRBİRİNE BAĞLAYAN tek yer burasıdır, bu yüzden voice/ ve
// avatar/ buradan görülür. Kural gevşetilmedi; bağlama işi tek dosyaya hapsedildi.
"use strict";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Culling/ray"; // Scene.pickWithRay yan etkisi
import { Saat, TIK_HZ } from "./engine/tik.ts";
import { KameraRig } from "./engine/kamera.ts";
import { odaKur } from "./level/oda.ts";
import { capaAdlari, tumCapalar } from "./level/capalar.ts";
import { capaKonumu } from "./level/capaGeometri.ts";
import { Oyuncu } from "./player/oyuncu.ts";
import { EtkilesimOlaylari } from "./player/etkilesim.ts";
import { PiperCikisi } from "../voice/cikis.ts";
import { avatarKur, VARSAYILAN_VRM, type Avatar } from "./avatar/index.ts";
import { monitorKur, type Monitor } from "./surfaces/monitor.ts";
import { niyetDogrula } from "../protocol/dogrula.ts";
import { varlik } from "./varlik.ts";

const tuval = document.getElementById("tuval") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLDivElement;
const altyazi = document.getElementById("altyazi") as HTMLDivElement;

// ── Motor + sahne ──────────────────────────────────────────────────────────
const motor = new Engine(tuval, true, { preserveDrawingBuffer: false, stencil: true }, true);
const sahne = new Scene(motor);
sahne.clearColor = new Color4(0.027, 0.027, 0.051, 1);
// Çarpışmayı kendimiz yapıyoruz (AABB, olculer.ts) — Babylon'un collider
// altyapısı kurulmaz: her karede gereksiz ellipsoid testi yok.
sahne.collisionsEnabled = false;
// Statik dekor çoğunlukta; aktif mesh listesi her karede yeniden kurulmasın.
sahne.skipPointerMovePicking = true;
sahne.autoClear = true;

// ── Dünya ──────────────────────────────────────────────────────────────────
const oda = odaKur(sahne);
const rig = new KameraRig(sahne, tuval);
const oyuncu = new Oyuncu(sahne, oda, rig, { dogumYeri: new Vector3(2.6, 0, 2.6) });

const saat = new Saat();

// ── Monitör: masadaki ekran gerçek bir terminal olur ───────────────────────
const monitor: Monitor = monitorKur({ sahne, ekran: oda.monitorEkran });

// ── Orion: avatar asenkron yüklenir, sahne onsuz da ayakta kalır ───────────
let orion: Avatar | null = null;
void avatarKur({
  sahne, saat,
  spawn: { x: 0.9, y: 0, z: -1.2 },
  vrmYolu: varlik(VARSAYILAN_VRM),
  // bak {tip:"oyuncu"} için: avatar oyuncunun yerini buradan öğrenir.
  oyuncuKonumu: () => oyuncu.oyuncuDurumu().konum,
}).then((a) => {
  orion = a;
  a.sonucDinle((s) => {
    console.log(`[NIYET] ${s.niyet_id} → ${s.durum}${s.not ? ` (${s.not})` : ""}`);
    if (s.durum === "hata") altyaziGoster(`yapamadım: ${s.not ?? "bilinmeyen"}`);
  });
  console.log("[ORION] avatar hazır");
}).catch((e) => console.error("[ORION] avatar kurulamadı:", e));

// ── MANTIK: 20Hz ───────────────────────────────────────────────────────────
let mantikTik = 0;
saat.dinle((t, dt) => {
  mantikTik++;
  oyuncu.guncelle(t, dt);
  rig.guncelle(dt);
});

// ── ÇİZİM: serbest FPS ─────────────────────────────────────────────────────
motor.runRenderLoop(() => {
  const ms = motor.getDeltaTime();
  saat.ilerle(ms);
  rig.cizimGuncelle(Math.min(ms, 100) / 1000);
  // Ağız senkronu: sesin gerçek RMS'i avatara burada bağlanır. voice/ ile
  // avatar/ birbirini tanımaz; bağ tek yönlü ve tek satır.
  // Avatarın görsel yumuşatması render karesinde. Bu çağrı EKSİKTİ: mantık
  // 20Hz'de koşuyordu ama mesh hiç güncellenmiyordu — Orion hareket ediyor
  // ama görünmüyordu.
  if (orion) {
    orion.cizimGuncelle(Math.min(ms, 100) / 1000);
    if (orionSesi.konusuyorMu()) orion.agizAyarla(orionSesi.agizAcikligi());
  }
  sahne.render();
});

addEventListener("resize", () => motor.resize());

// ── Etkileşim → altyazı/HUD ────────────────────────────────────────────────
// T3 (monitör) ve T4 (köprü) aynı yayıcıya abone olacak. Burada yalnızca
// kullanıcıya geri bildirim var; protokol mesajı ÜRETİLMEZ.
let ipucuMetin = "";
EtkilesimOlaylari.dinle("ipucu", (i) => { ipucuMetin = i?.metin ?? ""; });

function altyaziGoster(metin: string, ms = 2200): void {
  altyazi.textContent = metin;
  altyazi.dataset.gorunur = "1";
  clearTimeout(altyaziZaman);
  altyaziZaman = setTimeout(() => { altyazi.dataset.gorunur = "0"; }, ms);
}
let altyaziZaman: ReturnType<typeof setTimeout>;

EtkilesimOlaylari.dinle("basladi", (o) => {
  altyaziGoster(`${o.capa} · ${o.eylem} — çıkmak için Esc`);
  console.log(`[etkilesim] basladi capa=${o.capa} eylem=${o.eylem} t=${o.t.toFixed(2)}`);
  if (o.capa === "monitor") void monitoreGec();
});
EtkilesimOlaylari.dinle("bitti", (o) => {
  altyaziGoster("etkileşim kapandı");
  console.log(`[etkilesim] bitti capa=${o.capa}`);
  if (o.capa === "monitor") monitordenCik();
});

/**
 * Monitöre geçiş.
 *
 * Kamerayı ekrana YAKLAŞTIRIYORUZ çünkü ölçüldü: 1.5 m'den 80×24 terminal
 * hücre başına 4.4 piksel düşüyor ve okunmuyor — bu fiziksel bir sınır,
 * gerçek hayatta da okunmaz. ~0.6 m'de hücre başına ~11 piksel, rahat okunur.
 */
async function monitoreGec(): Promise<void> {
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

/** Esc: klavye dünyaya döner, kamera serbest kalır. Terminal AÇIK kalır —
 *  çalışan bir claude oturumu masadan kalkınca ölmemeli. */
function monitordenCik(): void {
  monitor.odaklan(false);
  rig.odakBirak();
}

// ── HUD: K1 ve K2 ölçümleri ekranda. "Sanırım hızlı" yerine sayı. ─────────
setInterval(() => {
  const hz = saat.olculenHz;
  const d = oyuncu.oyuncuDurumu();
  hud.textContent =
    `FPS ${motor.getFps().toFixed(0)}  |  tik ${hz.toFixed(2)} Hz (hedef ${TIK_HZ})  ` +
    `|  tik# ${mantikTik}  |  atlanan ${saat.atlanan}\n` +
    `kamera ${rig.mod === "omuz" ? "3.şahıs (F: 1.şahıs)" : "1.şahıs (F: 3.şahıs)"}  ` +
    `|  konum ${d.konum.x.toFixed(1)},${d.konum.z.toFixed(1)}  ` +
    `|  mesh ${oda.meshler.length}  |  çapa ${tumCapalar().length}\n` +
    (ipucuMetin ? ipucuMetin : "WASD yürü · Shift koş · F kamera · E etkileşim · Esc çık");
}, 250);

// ── Demo kancası (T7): sinematik çekim konsoldan tetiklenebilsin ───────────
// `window.dunya.sinematik("tahta")` → kamera tahtayı çerçeveler.
// Bu bir DEBUG yüzeyi; protokol değil, köprü değil.
(window as unknown as { dunya: unknown }).dunya = {
  sinematik(capa: string, sure = 4): boolean {
    const k = capaKonumu(capa);
    if (!k) { console.warn(`[dunya] bilinmeyen çapa: ${capa}. Geçerli: ${capaAdlari().join(", ")}`); return false; }
    rig.sinematikBak(k, 2.6, 0.7, sure);
    return true;
  },
  oyuncuDurumu: () => oyuncu.oyuncuDurumu(),
  capalar: capaAdlari,

  /**
   * Orion'a elle niyet gönder — T4 (köprü) gelene kadar deneme yüzeyi.
   * Örnek: dunya.niyet("git", { hedef: { tip: "capa", ad: "tahta" } })
   * Doğrulama ATLANMAZ: protokolün kendi doğrulayıcısından geçer.
   */
  niyet(tur: string, govde: Record<string, unknown> = {}): string {
    if (!orion) return "avatar henüz hazır değil";
    const d = niyetDogrula({ ...govde, tur });
    if (!d.ok) { console.warn(`[niyet] reddedildi: ${d.hata}`); return d.hata; }
    const id = `elle_${Date.now().toString(36)}`;
    orion.niyet(d.deger, id);
    return id;
  },
  orionDurumu: () => orion?.durum() ?? null,
  terminal: {
    ac: () => monitoreGec(),
    kapat: () => { monitor.kapat(); rig.odakBirak(); },
    kuyruk: (n?: number) => monitor.kuyruk(n),
  },
};

// ── Hızlı deneme tuşları (1-6) ────────────────────────────────────────────
// Terminal odaktayken devre dışı: orada rakamlar kabuğa gitmeli.
const HIZLI_NIYETLER: Record<string, [string, Record<string, unknown>]> = {
  "1": ["git",  { hedef: { tip: "capa", ad: "tahta" } }],
  "2": ["git",  { hedef: { tip: "capa", ad: "pencere" } }],
  "3": ["otur", {}],
  "4": ["kalk", {}],
  "5": ["bak",  { hedef: { tip: "oyuncu" } }],
  "6": ["jest", { jest: "el_salliyor" }],
};
addEventListener("keydown", (e) => {
  const d = oyuncu.oyuncuDurumu();
  if (d.etkilesim === "monitor") return;  // terminal odakta
  const n = HIZLI_NIYETLER[e.key];
  if (!n || !orion) return;
  const sonuc = (window as unknown as { dunya: { niyet(t: string, g?: Record<string, unknown>): string } })
    .dunya.niyet(n[0], n[1]);
  altyaziGoster(`Orion: ${n[0]} ${JSON.stringify(n[1]).slice(0, 40)}`, 1600);
  console.log(`[hizli] ${e.key} → ${n[0]} (${sonuc})`);
});

// ── Entegrasyon duman testi: terminal gerçekten açılıyor mu? ───────────────
// Kullanıcı E'ye bastığında çalışacağını ELDEN ÖNCE kanıtlar.
if (new URLSearchParams(location.search).has("terminaldene")) {
  void (async () => {
    try {
      await monitoreGec();
      await new Promise((r) => setTimeout(r, 1400));
      window.kopru; // köprü hazır olmalı
      const yaz = (m: string) => document.dispatchEvent(
        new KeyboardEvent("keydown", { key: m, bubbles: true }));
      for (const ch of "echo ORION ENTEGRASYON") yaz(ch);
      yaz("Enter");
      await new Promise((r) => setTimeout(r, 1200));
      console.log("[TERMDENE] acik=" + monitor.acikMi());
      for (const satir of monitor.kuyruk(8).split(String.fromCharCode(10))) {
        if (satir.trim()) console.log("[TERMDENE] | " + satir);
      }
    } catch (e) {
      console.error("[TERMDENE] hata:", e);
    }
  })();
}


// ── Otomatik entegrasyon denemesi (?otodene=1) ─────────────────────────────
// Ozyn'in elle bulduğu üç hatayı bir daha geri gelmesinler diye kilitler.
// Gerçek klavye/fare olaylarıyla, gerçek sahnede koşar.
if (new URLSearchParams(location.search).has("otodene")) {
  void (async () => {
    const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const sonuclar: string[] = [];
    const kontrol = (ad: string, gecti: boolean, detay = "") =>
      sonuclar.push(`${gecti ? "GECTI" : "KALDI"}  ${ad}${detay ? "  " + detay : ""}`);

    await bekle(1500);

    // 1) Orion GÖRSEL olarak hareket ediyor mu? (mantık değil, mesh)
    // TS, .then içindeki atamayı göremediği için orion'u null sanıyor; yerel al.
    const o = orion as Avatar | null;
    if (!o) { kontrol("avatar yuklendi", false); }
    else {
      const once = o.cizimKonumu();
      o.niyet({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }, "dene_git");
      await bekle(2500);
      const sonra = o.cizimKonumu();
      const yol = Math.hypot(sonra.x - once.x, sonra.z - once.z);
      kontrol("orion gorsel olarak hareket etti", yol > 0.5,
        `yol=${yol.toFixed(2)}m mantik=${o.durum().konum.x.toFixed(2)},${o.durum().konum.z.toFixed(2)}`);
    }

    // 2) Terminale gir — E tuşunun yaptığı akışın AYNISI: önce etkileşim
    //    yayıcıya kaydolur, sonra monitöre geçilir. (Doğrudan monitoreGec()
    //    çağırmak gerçek akışı atlar ve Esc'in kapatacağı bir şey kalmaz.)
    EtkilesimOlaylari.baslat({
      capa: "monitor", eylem: "odaklan", t: saat.t,
      kaynak: oyuncu.oyuncuDurumu().konum,
    });
    await bekle(900);
    const odakOnce = rig.odakta;
    for (let i = 0; i < 10; i++) {
      dispatchEvent(new MouseEvent("mousemove", { movementX: 40, movementY: 25, bubbles: true }));
    }
    await bekle(300);
    kontrol("fare oynayinca terminal odagi korunuyor", odakOnce && rig.odakta,
      `odakOnce=${odakOnce} odakSonra=${rig.odakta}`);

    // 3) TEXTAREA odaktayken Esc dunyaya ulasiyor mu? (hapsolma hatasi)
    const sahteAlan = document.createElement("textarea");
    document.body.appendChild(sahteAlan);
    sahteAlan.focus();
    sahteAlan.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    await bekle(400);
    kontrol("TEXTAREA odaktayken Esc cikis yapiyor",
      !rig.odakta && oyuncu.oyuncuDurumu().etkilesim === null,
      `odak=${rig.odakta} etkilesim=${oyuncu.oyuncuDurumu().etkilesim ?? "-"}`);
    sahteAlan.remove();

    // 4) Cikis sonrasi yurume yeniden calisiyor mu?
    const yurumeOnce = oyuncu.oyuncuDurumu().konum;
    dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "w", bubbles: true }));
    await bekle(700);
    dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW", key: "w", bubbles: true }));
    const yurumeSonra = oyuncu.oyuncuDurumu().konum;
    const gidilen = Math.hypot(yurumeSonra.x - yurumeOnce.x, yurumeSonra.z - yurumeOnce.z);
    kontrol("cikistan sonra oyuncu yeniden yuruyor", gidilen > 0.1, `yol=${gidilen.toFixed(2)}m`);

    for (const r of sonuclar) console.log("[OTODENE] " + r);
    console.log("[OTODENE] ozet: " +
      sonuclar.filter((r) => r.startsWith("GECTI")).length + "/" + sonuclar.length);
  })();
}

// ── Duman testi kanıtı ─────────────────────────────────────────────────────
setTimeout(() => {
  const d = oyuncu.oyuncuDurumu();
  console.log(
    `[DUMAN] fps=${motor.getFps().toFixed(1)} hz=${saat.olculenHz.toFixed(2)} ` +
    `tik=${saat.tikSayisi} atlanan=${saat.atlanan} ` +
    `kamera=${rig.mod} mesh=${oda.meshler.length} capa=${tumCapalar().length} ` +
    `oyuncu=${d.konum.x.toFixed(2)},${d.konum.y.toFixed(2)},${d.konum.z.toFixed(2)} ` +
    `etkilesim=${d.etkilesim ?? "-"} kopru=${typeof window.kopru} ` +
    `orion=${orion ? `${orion.durum().poz}@${orion.durum().konum.x.toFixed(2)},${orion.durum().konum.z.toFixed(2)}` : "yok"} ` +
    `monitor=${monitor.acikMi() ? "acik" : "kapali"}`
  );
}, 4000);

// ---- Orion'un sesi --------------------------------------------------------
// Birleştirme noktası burası: voice/ ile world/ birbirini import etmez (K4),
// ikisini giris.ts bağlar. Avatar geldiğinde (T2) agizAcikligi() buradan
// avatar.agizAyarla()'ya beslenecek.
const orionSesi = new PiperCikisi();
(window as unknown as { orionSes: PiperCikisi }).orionSes = orionSesi;

void (async () => {
  const kurulu = await orionSesi.kurulumKontrol();
  console.log(`[SES] piper kurulu=${kurulu}`);
  if (!kurulu) return;

  const sorgu = new URLSearchParams(location.search);
  if (sorgu.has("sessiz")) return;

  // ORION_SOZ verilmişse yalnızca onu söyle — elle deneme için.
  const istenen = sorgu.get("soz");
  if (istenen) {
    const oldu = await orionSesi.soyle(istenen);
    console.log(`[SES] istenen soyle=${oldu} baslama_gecikmesi=${orionSesi.baslamaGecikmesi.toFixed(0)}ms ses_uzunlugu=${orionSesi.sonSure.toFixed(2)}sn`);
    return;
  }

  // Açılışta tek selam. (Ölçüm koşumu ORION_SOZ ile ayrıca yapılabiliyor.)
  const cumleler = ["Merhaba Ozyn. Odama hoş geldin. Terminal masamda, istediğin zaman aç."];
  for (let i = 0; i < cumleler.length; i++) {
    const oldu = await orionSesi.soyle(cumleler[i]!);
    console.log(
      `[SES] cumle${i + 1} soyle=${oldu} ` +
      `baslama_gecikmesi=${orionSesi.baslamaGecikmesi.toFixed(0)}ms ` +
      `ses_uzunlugu=${orionSesi.sonSure.toFixed(2)}sn tepe_agiz=${orionSesi.tepeAgiz.toFixed(3)}`
    );
  }
})();
