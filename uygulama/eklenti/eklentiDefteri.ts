// uygulama/eklenti/eklentiDefteri.ts — EKLENTİ DEFTERİ (spec 40): motorun açılıp kapanan parçalarının tek kayıt yeri. SAF (DOM yok, Babylon yok).
//
// KURALLAR (eklentiDefteri.test.ts):
//   1. Durum önceliği: ORTAM (`ORION_EKLENTI`, yalnız senaryolar) > kalıcı kayıt > bildirimin varsayılanı. Ortam kalıcı kayda YAZILMAZ.
//   2. Bağımlılık: bağımlısı kapalıysa eklenti açılmaz; bağımlısı açıkken kapatılmaz (neden dönen mesajda). Döngü ve bilinmeyen bağımlılık `baslat`ta hatadır.
//   3. `etki: "aninda"` eklenti açılıp kapanınca `kur`/`kapat` HEMEN çalışır. `etki: "yeniden_baslat"` olanın durumu kaydedilir ama çalışan hâl AÇILIŞTAKİ
//      kalır; `bekleyen` bunu söyler (panel sahte "anında" göstermez).
//   4. Bir eklentinin `kur`u fırlatırsa o eklenti çalışmaz, hata durumunda görünür; ötekiler etkilenmez.
//   5. Kalıcılık hatası (dolu depo, kapalı depolama) çökertmez: `uyarilar`a yazılır, bellek durumu geçerli kalır.
"use strict";
import {
  eklentiKimligiGecerli, EKLENTI_SURUMU, kayitDogrula,
  type EklentiBildirimi, type EklentiKaydi, type KayitSonucu,
} from "../../protocol/eklenti.ts";

/** `kur`a verilen bağlam: seçenek CANLI okunur (açılışta alınıp bayatlamasın). */
export interface EklentiBaglami { secenek(): string | null; acikMi(id: string): boolean }
export interface EklentiElcisi { kapat(): void }
export interface Eklenti {
  bildirim: EklentiBildirimi;
  kur?(b: EklentiBaglami): EklentiElcisi | void;
  /** Açılışta eklenti KAPALIYSA bir kez çağrılır (ör. kendiliğinden kaydolan paneli gizler). Fırlatırsa hata olarak görünür. */
  kapaliBaslat?(): void;
}
export interface EklentiDeposu { oku(): string | null; yaz(metin: string): void }

export interface EklentiDurumu {
  bildirim: EklentiBildirimi;
  /** Ozyn'in (kayıt/ortam/varsayılan) istediği durum. */
  acik: boolean;
  secenek: string | null;
  /** `kur` gerçekten çalıştı ve kapanmadı. */
  calisiyor: boolean;
  /** `yeniden_baslat` eklentisinde istenen durum çalışandan farklı. */
  bekleyen: boolean;
  /** Kur hatası ya da bağımlılık sorunu. */
  hata: string | null;
  /** Şu an açılıp kapatılamıyorsa nedeni (kilit / bağımlılık). */
  engel: string | null;
}

export type DefterSonucu = { ok: true } | { ok: false; neden: string };

export interface EklentiDefteri {
  kaydet(e: Eklenti): void;
  /** Kayıtlı eklentileri bağımlılık sırasıyla kurar. Bir kez. */
  baslat(): void;
  ac(id: string): DefterSonucu;
  kapat(id: string): DefterSonucu;
  secenekYaz(id: string, secenek: string): DefterSonucu;
  acikMi(id: string): boolean;
  /** Ozyn'in istediği durum (`baslat`tan ÖNCE de okunur): kurulum zamanı kararları için (ör. Flash hiç kurulmasın). Bilinmeyen kimlik false. */
  istenenAcik(id: string): boolean;
  /** Eklentinin seçimi (yoksa null). */
  secenek(id: string): string | null;
  durum(): EklentiDurumu[];
  dinle(cb: () => void): () => void;
  readonly uyarilar: readonly string[];
}

export interface EklentiDefteriAyari {
  depo?: EklentiDeposu | null;
  /** `ortamKaydi(process.env.ORION_EKLENTI)` sonucu; kalıcı kayda yazılmaz. */
  ortam?: KayitSonucu;
}

export function eklentiDefteriKur(ayar: EklentiDefteriAyari = {}): EklentiDefteri {
  const eklentiler = new Map<string, Eklenti>();
  const uyarilar: string[] = [];
  const dinleyiciler = new Set<() => void>();
  const calisan = new Map<string, EklentiElcisi | null>();
  const hatalar = new Map<string, string>();
  const acilistaki = new Map<string, { acik: boolean; secenek: string | null }>();
  let baslatildi = false;

  // Kalıcı kayıt + ortam (ortam kayda yazılmaz: ayrı tutulur, okurken önce o bakılır).
  const okunan = ((): KayitSonucu => {
    let ham: string | null = null;
    try { ham = ayar.depo?.oku() ?? null; } catch (e) { uyarilar.push(`eklenti kaydı okunamadı: ${e instanceof Error ? e.message : String(e)}`); }
    return kayitDogrula(ham);
  })();
  uyarilar.push(...okunan.uyarilar, ...(ayar.ortam?.uyarilar ?? []));
  const kayit: EklentiKaydi = okunan.kayit;
  const ortam = ayar.ortam?.kayit.durum ?? {};

  const yay = (): void => { for (const cb of [...dinleyiciler]) { try { cb(); } catch (e) { console.warn("[eklenti] dinleyici hatası:", e); } } };
  const kaydiYaz = (): void => {
    try { ayar.depo?.yaz(JSON.stringify({ surum: EKLENTI_SURUMU, durum: kayit.durum })); }
    catch (e) { uyarilar.push(`eklenti kaydı yazılamadı: ${e instanceof Error ? e.message : String(e)}`); }
  };

  const istenen = (e: Eklenti): { acik: boolean; secenek: string | null } => {
    const b = e.bildirim, o = ortam[b.id], k = kayit.durum[b.id];
    const acik = o?.acik ?? k?.acik ?? b.varsayilan === "acik";
    const gecerli = (s: string | undefined): s is string => !!s && !!b.secenek?.secenekler.some((x) => x.id === s);
    const secenek = b.secenek ? (gecerli(o?.secenek) ? o!.secenek! : gecerli(k?.secenek) ? k!.secenek! : b.secenek.varsayilan) : null;
    return { acik, secenek };
  };
  const bak = (id: string): Eklenti | undefined => eklentiler.get(id);
  const bagimlilar = (id: string): string[] => [...eklentiler.values()].filter((x) => x.bildirim.bagimli?.includes(id) && istenen(x).acik).map((x) => x.bildirim.id);

  function calistir(e: Eklenti): void {
    const id = e.bildirim.id;
    hatalar.delete(id);
    try {
      const elci = e.kur?.({ secenek: () => istenen(e).secenek, acikMi: (x) => bak(x) !== undefined && istenen(bak(x)!).acik && calisan.has(x) }) ?? null;
      calisan.set(id, elci ?? null);
    } catch (err) {
      calisan.delete(id);
      hatalar.set(id, err instanceof Error ? err.message : String(err));
      console.warn(`[eklenti] ${id} kurulamadı:`, err);
    }
  }
  function durdur(e: Eklenti): void {
    const id = e.bildirim.id;
    const elci = calisan.get(id);
    calisan.delete(id);
    try { elci?.kapat(); } catch (err) { console.warn(`[eklenti] ${id} kapanırken hata:`, err); hatalar.set(id, err instanceof Error ? err.message : String(err)); }
  }

  function engel(e: Eklenti): string | null {
    const b = e.bildirim;
    if (b.kilitli) return `kilitli: ${b.kilitli}`;
    const acikBagimlilar = bagimlilar(b.id);
    if (istenen(e).acik && acikBagimlilar.length) return `önce şunları kapat: ${acikBagimlilar.join(", ")}`;
    if (!istenen(e).acik) { const eksik = (b.bagimli ?? []).find((x) => { const h = bak(x); return !h || !istenen(h).acik; }); if (eksik) return `önce '${eksik}' eklentisini aç`; }
    return null;
  }

  return {
    kaydet(e) {
      if (baslatildi) throw new Error(`eklenti '${e.bildirim.id}' başlatmadan SONRA kaydedilemez`);
      const b = e.bildirim;
      if (!eklentiKimligiGecerli(b.id)) throw new Error(`geçersiz eklenti kimliği: ${JSON.stringify(b.id)}`);
      if (eklentiler.has(b.id)) throw new Error(`eklenti zaten kayıtlı: ${b.id}`);
      if (b.secenek && !b.secenek.secenekler.some((s) => s.id === b.secenek!.varsayilan)) throw new Error(`${b.id}: varsayılan seçenek listede yok`);
      eklentiler.set(b.id, e);
    },

    baslat() {
      if (baslatildi) return;
      baslatildi = true;
      // Bağımlılık doğrulaması + topolojik sıra (döngü ve bilinmeyen bağımlılık hata; bağımlılar kapalı bırakılır).
      const sira: Eklenti[] = [], durum = new Map<string, "gez" | "bitti">();
      const gez = (e: Eklenti, yol: string[]): void => {
        const id = e.bildirim.id, d = durum.get(id);
        if (d === "bitti") return;
        if (d === "gez") { hatalar.set(id, `bağımlılık döngüsü: ${[...yol, id].join(" → ")}`); return; }
        durum.set(id, "gez");
        for (const x of e.bildirim.bagimli ?? []) {
          const h = bak(x);
          if (!h) { hatalar.set(id, `bilinmeyen bağımlılık: ${x}`); continue; }
          gez(h, [...yol, id]);
        }
        durum.set(id, "bitti");
        sira.push(e);
      };
      for (const e of eklentiler.values()) gez(e, []);
      for (const e of sira) {
        const id = e.bildirim.id, s = istenen(e);
        acilistaki.set(id, s);
        if (!s.acik) { try { e.kapaliBaslat?.(); } catch (err) { hatalar.set(id, err instanceof Error ? err.message : String(err)); } continue; }
        if (hatalar.has(id)) continue;
        const eksik = (e.bildirim.bagimli ?? []).find((x) => !calisan.has(x));
        if (eksik) { hatalar.set(id, `bağımlılık çalışmıyor: ${eksik}`); continue; }
        calistir(e);
      }
      yay();
    },

    ac(id) {
      const e = bak(id);
      if (!e) return { ok: false, neden: `bilinmeyen eklenti: ${id}` };
      const b = e.bildirim;
      if (istenen(e).acik && (b.etki === "yeniden_baslat" || calisan.has(id))) return { ok: true };
      const eksik = (b.bagimli ?? []).find((x) => { const h = bak(x); return !h || !istenen(h).acik; });
      if (eksik) return { ok: false, neden: `önce '${eksik}' eklentisini aç` };
      kayit.durum[id] = { acik: true, ...(istenen(e).secenek ? { secenek: istenen(e).secenek! } : {}) };
      if (ortam[id]) delete ortam[id];   // Ozyn paneli kullandı: ortam geçersiz kılması artık geçerli değil
      if (b.etki === "aninda" && baslatildi) {
        calistir(e);
        if (hatalar.has(id)) { kayit.durum[id] = { ...kayit.durum[id]!, acik: false }; kaydiYaz(); yay(); return { ok: false, neden: `kurulamadı: ${hatalar.get(id)}` }; }
      }
      kaydiYaz(); yay();
      return { ok: true };
    },

    kapat(id) {
      const e = bak(id);
      if (!e) return { ok: false, neden: `bilinmeyen eklenti: ${id}` };
      const b = e.bildirim;
      if (b.kilitli) return { ok: false, neden: `kilitli: ${b.kilitli}` };
      if (!istenen(e).acik) return { ok: true };
      const acik = bagimlilar(id);
      if (acik.length) return { ok: false, neden: `önce şunları kapat: ${acik.join(", ")}` };
      kayit.durum[id] = { acik: false, ...(istenen(e).secenek ? { secenek: istenen(e).secenek! } : {}) };
      if (ortam[id]) delete ortam[id];
      if (b.etki === "aninda" && baslatildi) durdur(e);
      kaydiYaz(); yay();
      return { ok: true };
    },

    secenekYaz(id, secenek) {
      const e = bak(id);
      if (!e) return { ok: false, neden: `bilinmeyen eklenti: ${id}` };
      const t = e.bildirim.secenek;
      if (!t) return { ok: false, neden: `${id} seçenek taşımıyor` };
      if (!t.secenekler.some((s) => s.id === secenek)) return { ok: false, neden: `${id}: geçersiz seçenek ${JSON.stringify(secenek)} (${t.secenekler.map((s) => s.id).join(", ")})` };
      kayit.durum[id] = { acik: istenen(e).acik, secenek };
      if (ortam[id]) delete ortam[id];
      kaydiYaz(); yay();
      return { ok: true };
    },

    istenenAcik: (id) => { const e = bak(id); return !!e && istenen(e).acik; },
    acikMi: (id) => { const e = bak(id); return !!e && istenen(e).acik && calisan.has(id); },
    secenek: (id) => { const e = bak(id); return e ? istenen(e).secenek : null; },

    durum() {
      return [...eklentiler.values()].map((e): EklentiDurumu => {
        const id = e.bildirim.id, s = istenen(e), a = acilistaki.get(id);
        const bekleyen = e.bildirim.etki === "yeniden_baslat" && !!a && (a.acik !== s.acik || a.secenek !== s.secenek);
        return { bildirim: e.bildirim, acik: s.acik, secenek: s.secenek, calisiyor: calisan.has(id), bekleyen, hata: hatalar.get(id) ?? null, engel: engel(e) };
      });
    },

    dinle(cb) { dinleyiciler.add(cb); return () => { dinleyiciler.delete(cb); }; },
    uyarilar,
  };
}
