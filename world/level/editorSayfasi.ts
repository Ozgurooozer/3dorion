// world/level/editorSayfasi.ts — Level EDİTÖRÜ sayfası (spec 17 ova denemesi → spec 22 editör → spec 23 genel).
//
// Level = veri: world/level/<ad>/<ad>.level.json. Sayfa onu DEPODAN okur (depo/levelDeposu.ts; geliştirmede
// httpDeposu — kompozisyon kökü burası), `levelKur` ile kurar (modüller: world/level/moduller/) ve level
// EDİTÖRÜNÜ açar (editor/editor.ts + arayuz/): level menüsü (aç / yeni / farklı kaydet), sahne ağacı, dünya
// ayarları, özellikler, varlık tarayıcısı, gizmo, geri/ileri al, Ctrl+S → dosya, çökme kurtarması. F1 kısayol
// kartı. Tab: uçuş kipi (fare kilitli serbest uçuş: WASD + fare, Space/E yukarı, Q/C aşağı, Shift hızlı).
//
//   /world/level/editor.html?level=ova   (ova-deneme.html = level=ova; eski adres ve araçlar için)
//   ?aci=<yer imi adı>  level'ın kamera yer imlerinden (ova: ufuk | alcak | tepe | gunes | gol); yoksa 1. yuva
//   ?piksel=3   tanımdaki `ortam.piksel`i geçersiz kılar (piksel kipi; panelde "Ortam › piksel boyu" aynı ayar —
//               bu açılışta Kaydet'e basılırsa değer dosyaya da yazılır)
//   ?panel=0    editör arayüzü yok, uçuş kipinde açılır (ekran görüntüsü için)
//   ?stil=toon  stil önayarıyla aç (stil/stilTanimi.ts ONAYARLAR) · ?renk=pastel renk düzeniyle aç
//   ?kapat=gi,ao  ışık sonrası gruplarını kapat (maliyet ölçümü) · ?saat=21 ?dunya=1 ?shader=zamanKirigi,firca
// Tuşlar: P stil önayarları arasında döner, Shift+P renk düzenleri arasında (spec 18). Shader derleme hatası
// ölçüm satırına ve başlığa "hata=N" olarak düşer (sessiz boş görüntü yok).
// Hazır olunca (3 sn ölçüm) başlık "hazir …" olur — tools/oda-goruntu.mjs bunu bekler.
"use strict";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";
import { levelKur } from "./cekirdek/levelKur.ts";
import { MODULLER } from "./moduller/index.ts";
import { inspektorAcKapa } from "./editor/inspektor.ts";
import { editorKur } from "./editor/editor.ts";
import { editorArayuzuKur, editorAyarlariniOku } from "./editor/arayuz/editorArayuzu.ts";
import { Logger } from "@babylonjs/core/Misc/logger";
import type { SonStili } from "./stil/stilTanimi.ts";
import { SHADERLAR } from "./shader/moduller/index.ts";
import { ZAMAN_VARSAYILAN } from "./shader/dunyaDurumu.ts";
import { onayarUygula, onayarAdi, paletDuzeniUygula } from "./stil/stilTanimi.ts";
import { httpDeposuKur } from "./depo/httpDeposu.ts";
import { yerImi, yerImiMutlak } from "./editor/cekirdek/komutlar.ts";
import type { Vec3 } from "./cekirdek/levelTanimi.ts";

const GOZ = 1.7;
const q = new URLSearchParams(location.search);
const levelAdi = q.get("level") ?? "ova";
const depo = httpDeposuKur();
const dosyadanOku = () => depo.oku(levelAdi);
const tuval = document.getElementById("tuval") as HTMLCanvasElement;
const olcumKutusu = document.getElementById("olcum") as HTMLDivElement;
const motor = new Engine(tuval, true, { preserveDrawingBuffer: true, stencil: true }, true);
const sahne = new Scene(motor);
// Babylon derleme hatalarını konsola yazar; onları say ki ekran görüntüsü aracı da görsün.
let shaderHatasi = 0;
const eskiKayit = Logger.OnNewCacheEntry;
Logger.OnNewCacheEntry = (girdi) => { if (/error/i.test(girdi)) shaderHatasi++; eskiKayit?.(girdi); };

try {
  const level = levelKur(sahne, await dosyadanOku(), MODULLER);
  if (q.has("piksel")) {
    const t = level.tanim();
    t.ortam.piksel = Math.max(1, Math.min(8, Math.round(Number(q.get("piksel"))) || 1));
    level.ayarla(t);
  }
  if (q.has("stil")) level.ayarla(onayarUygula(level.tanim(), q.get("stil")!));
  if (q.has("renk")) level.ayarla(paletDuzeniUygula(level.tanim(), q.get("renk")!));
  // ?saat=21.5 · ?dunya=1 · ?shader=zamanKirigi,hataImzasi — başsız denemede zaman ve özel shader seçimi (spec 20).
  if (q.has("saat") || q.has("dunya") || q.has("shader")) {
    const t = level.tanim();
    t.zaman = { ...(t.zaman ?? ZAMAN_VARSAYILAN), ...(q.has("saat") ? { saat: Number(q.get("saat")) } : {}), ...(q.has("dunya") ? { dunya: Number(q.get("dunya")) } : {}) };
    for (const tur of (q.get("shader") ?? "").split(",").filter(Boolean)) {
      const liste = t.shaderlar ?? (t.shaderlar = []);
      const s = liste.find((x) => x.tur === tur);
      if (s) s.acik = true; else liste.push({ tur, acik: true, ayar: {} });
    }
    level.ayarla(t);
  }
  // ?kapat=gi,ao — ışık sonrası gruplarını yüklemede kapat (ölçüm: bir efektin maliyetini ayırmak için).
  if (q.has("kapat")) {
    const t = level.tanim();
    for (const g of q.get("kapat")!.split(",")) { const grup = t.stil?.son?.[g as Exclude<keyof SonStili, "tonlama">]; if (grup) grup.acik = false; }
    level.ayarla(t);
  }

  // Başlangıç açısı level verisinden: ?aci=<yer imi adı>, yoksa 1. yuva, o da yoksa merkezde göz yüksekliği.
  const yerler = level.tanim().kameraYerleri ?? [];
  const yer = (q.has("aci") ? yerler.find((y) => y.ad === q.get("aci")) : null) ?? yerImi(level.tanim(), 1) ?? yerler[0] ?? null;
  const ad = yer?.ad ?? "merkez";
  const bas: { konum: Vec3; hedef: Vec3 } = yer ? yerImiMutlak(yer, level.yukseklik) : { konum: [0, level.yukseklik(0, 0) + GOZ, 0], hedef: [60, GOZ, 0] };
  const kamera = new UniversalCamera("ova_kamera", new Vector3(...bas.konum), sahne);
  kamera.setTarget(new Vector3(...bas.hedef));
  kamera.fov = 0.95;
  kamera.minZ = 0.05;
  kamera.maxZ = level.tanim().ortam.kamera.uzak;
  // Uçuş kipi (Tab) girdileri; editör kipinde editör kamerası bunları söker (editor/sahne/kamera.ts).
  kamera.keysUp = [87]; kamera.keysDown = [83]; kamera.keysLeft = [65]; kamera.keysRight = [68];
  kamera.keysUpward = [32, 69]; kamera.keysDownward = [81, 67];   // Space/E yukarı, Q/C aşağı (zemine kilit yok)
  kamera.angularSensibility = 2500;
  let kos = false;
  addEventListener("keydown", (e) => { if (e.key === "Shift") kos = true; });
  addEventListener("keyup", (e) => { if (e.key === "Shift") kos = false; });
  level.stil.kameraBagla(kamera);

  // Level editörü (spec 22). ?panel=0: arayüz yok, uçuş kipinde açılır (temiz ekran görüntüsü: ızgara/gizmo yok).
  const arayuzVar = q.get("panel") !== "0";
  const editor = editorKur({
    level, kamera, tuval,
    ayarlar: editorAyarlariniOku(),
    inspektor: () => inspektorAcKapa(sahne),
    kaydet: (t) => depo.kaydet(levelAdi, t),
  });
  if (arayuzVar) editorArayuzuKur(editor, { ad: levelAdi, depo, moduller: MODULLER, shaderlar: SHADERLAR });
  else editor.durum.kipAyarla("ucus");
  // Konsoldan / başsız denemeden erişim (yalnız bu deneme sayfası): window.ova.editor.eylem("odakla")…
  Object.assign(window, { ova: { level, editor, sahne, kamera } });

  const olcer = new SceneInstrumentation(sahne);
  olcer.captureFrameTime = true;
  sahne.onBeforeRenderObservable.add(() => {
    level.guncelle(motor.getDeltaTime() / 1000);
    kamera.speed = kos ? 0.6 : 0.25;
    kamera.maxZ = level.tanim().ortam.kamera.uzak;
  });
  motor.runRenderLoop(() => sahne.render());
  addEventListener("resize", () => motor.resize());

  sahne.executeWhenReady(() => {
    const bas = performance.now();
    let kare = 0, cizim = 0;
    sahne.onAfterRenderObservable.add(() => { kare++; cizim += olcer.drawCallsCounter.current; });
    setTimeout(() => {
      const sn = (performance.now() - bas) / 1000;
      // İnce örnekli mesh (çim) tek tutamın üçgenini × örnek sayısı kadar çizer.
      const ucgen = sahne.getActiveMeshes().data.reduce((t, m) => {
        const kopya = m && "thinInstanceCount" in m ? Math.max(1, Number(m.thinInstanceCount) || 0) : 1;
        return t + ((m?.getTotalIndices?.() ?? 0) / 3) * kopya;
      }, 0);
      const s = level.sayim();
      const ozet = `level=${levelAdi} aci=${ad} stil=${onayarAdi(level.tanim())} hata=${shaderHatasi} piksel=${level.tanim().ortam.piksel} fps=${(kare / sn).toFixed(1)} cizim=${(cizim / Math.max(kare, 1)).toFixed(0)} ucgen=${Math.round(ucgen)} katman=${s.katman} mesh=${s.mesh}`;
      olcumKutusu.textContent = ozet;
      console.log(`[LEVEL-EDITOR] ${ozet}`);
      document.title = `hazir ${ozet}`;
    }, 3000);
  });
} catch (err) {
  // Bozuk tanım sessizce boş sahne göstermez: hata ekranda.
  const m = err instanceof Error ? err.message : String(err);
  olcumKutusu.textContent = `HATA: ${m}`;
  olcumKutusu.style.color = "#b00020";
  document.title = `hata ${m}`;
  console.error("[LEVEL-EDITOR]", err);
}
