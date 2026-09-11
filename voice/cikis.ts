// voice/cikis.ts — Orion'un sesi: TTS çağrısı, çalma ve ağız senkronu.
//
// Ağız senkronu gerçek sinyalden gelir, uydurma animasyondan değil: WebAudio
// AnalyserNode ile anlık RMS ölçülür, 0..1'e eşlenir ve avatar (T2) bunu
// `setBlend("agiz", x)` olarak okur. Fonem seviyesinde viseme yok — 8GB
// bütçede gereksiz; ağız açıklığı konuşma hissini vermeye yeter.
"use strict";
import type { SesCikisi } from "./tip.ts";

/** Sessizlik eşiği: bunun altındaki RMS ağzı kapatır (nefes gürültüsü açmasın). */
const ESIK = 0.012;
/** Ağız açılma/kapanma yumuşatması — ham RMS titrer, avatar zıplar. */
const YUMUSATMA = 0.35;

export class PiperCikisi implements SesCikisi {
  private _ctx: AudioContext | null = null;
  private _analiz: AnalyserNode | null = null;
  private _kaynak: AudioBufferSourceNode | null = null;
  private _tampon = new Float32Array(1024);
  private _agiz = 0;
  private _konusuyor = false;
  private _kurulumVar: boolean | null = null;
  private _nabiz: number | null = null;

  kullanilabilir(): boolean { return this._kurulumVar !== false; }

  /** Bir kez sorulur, sonucu saklanır. UI ses düğmesini buna göre çizer. */
  async kurulumKontrol(): Promise<boolean> {
    if (this._kurulumVar !== null) return this._kurulumVar;
    try { this._kurulumVar = await window.kopru.sesVarMi(); }
    catch { this._kurulumVar = false; }
    return this._kurulumVar;
  }

  async soyle(metin: string): Promise<boolean> {
    if (!metin.trim()) return false;
    this.kes();
    let bayt: Uint8Array;
    try {
      const c = await window.kopru.sesUret(metin);
      if (!c.ok || !c.ses) { console.warn("[ses] üretilemedi:", c.hata); return false; }
      bayt = c.ses;
    } catch (err) {
      console.warn("[ses] IPC hatası:", err);
      return false;
    }

    try {
      const ctx = this._ctxAl();
      // decodeAudioData tamponu tüketir (detach) — kopya ver.
      const kopya = bayt.slice().buffer as ArrayBuffer;
      const sesTamponu = await ctx.decodeAudioData(kopya);

      const kaynak = ctx.createBufferSource();
      kaynak.buffer = sesTamponu;
      const analiz = ctx.createAnalyser();
      analiz.fftSize = 2048;
      kaynak.connect(analiz);
      analiz.connect(ctx.destination);

      this._kaynak = kaynak;
      this._analiz = analiz;
      this._konusuyor = true;
      this._nabizBaslat();

      return await new Promise<boolean>((coz) => {
        kaynak.onended = () => { this._bitir(); coz(true); };
        kaynak.start();
      });
    } catch (err) {
      console.warn("[ses] çalma hatası:", err);
      this._bitir();
      return false;
    }
  }

  kes(): void {
    if (!this._kaynak) return;
    try { this._kaynak.onended = null; this._kaynak.stop(); } catch { /* zaten durmuş */ }
    this._bitir();
  }

  konusuyorMu(): boolean { return this._konusuyor; }
  agizAcikligi(): number { return this._agiz; }

  private _ctxAl(): AudioContext {
    if (!this._ctx) this._ctx = new AudioContext();
    // Kullanıcı etkileşimi öncesi askıya alınmış olabilir.
    if (this._ctx.state === "suspended") void this._ctx.resume();
    return this._ctx;
  }

  private _nabizBaslat(): void {
    const adim = () => {
      if (!this._konusuyor || !this._analiz) return;
      this._analiz.getFloatTimeDomainData(this._tampon);
      let kare = 0;
      for (let i = 0; i < this._tampon.length; i++) {
        const v = this._tampon[i] ?? 0;
        kare += v * v;
      }
      const rms = Math.sqrt(kare / this._tampon.length);
      const hedef = rms < ESIK ? 0 : Math.min(1, (rms - ESIK) * 7);
      this._agiz += (hedef - this._agiz) * YUMUSATMA;
      this._nabiz = requestAnimationFrame(adim);
    };
    this._nabiz = requestAnimationFrame(adim);
  }

  private _bitir(): void {
    this._konusuyor = false;
    if (this._nabiz !== null) { cancelAnimationFrame(this._nabiz); this._nabiz = null; }
    this._kaynak = null;
    this._analiz = null;
    this._agiz = 0;
  }
}
