// uygulama/ayar/sesBolumu.ts — AYAR PANELİ · SES bölümü: Orion'un Piper sesi — seç, indir (katalogdan), yalnız indirileni sil, dene (spec 34). DOM katmanı.
//
// Kurallar host'ta (host/sesler.js, testli): seçim bir SONRAKİ cümleden geçerli; `ORION_PIPER_MODEL` varken seçim kilitli ve nedeni yazar; yalnız katalogdaki
// ses iner (adres buradan gitmez); yalnız panelden indirilen ve şu an çalmayan ses silinir. Satır kuralları `ayarModelleri.ts` `sesSatirlari` (testli).
// "Dene" mevcut konuşma yolunu kullanır (`orionSesi.soyle` → `sesUret`): Orion'un gerçek konuşmasıyla aynı ses, aynı ağız senkronu.
"use strict";
import type { AyarBolumu } from "../../world/arayuz/ayarPaneli.ts";
import type { SesDurumu, SesIndirmeIlerlemesi } from "../../host/kopru.ts";
import { kabukKoprusu } from "../kabuk.ts";
import { ipcAc } from "../ipcSonuc.ts";
import { sesSatirlari } from "./ayarModelleri.ts";
import { dugme, el, hataMetni } from "./dom.ts";

export interface SesKaynagi {
  liste(): Promise<SesDurumu>;
  sec(ad: string): Promise<SesDurumu>;
  indir(ad: string): Promise<SesDurumu>;
  sil(ad: string): Promise<SesDurumu>;
  indirmeDinle(cb: (o: SesIndirmeIlerlemesi) => void): () => void;
}

/** Electron kabuğunda host IPC'si; değilse (npm run dev) null — bölüm nedenini söyler (sessiz boş liste değil). */
export function sesKaynaginiSec(): SesKaynagi | null {
  const k = kabukKoprusu();
  if (!k?.sesListe || !k.sesSec || !k.sesIndir || !k.sesSil || !k.sesIndirmeDinle) return null;
  const { sesListe, sesSec, sesIndir, sesSil, sesIndirmeDinle } = k;
  return {
    liste: async () => ipcAc(await sesListe()),
    sec: async (ad) => ipcAc(await sesSec(ad)),
    indir: async (ad) => ipcAc(await sesIndir(ad)),
    sil: async (ad) => ipcAc(await sesSil(ad)),
    indirmeDinle: (cb) => sesIndirmeDinle(cb),
  };
}

export interface SesBolumuAyari {
  kaynak: SesKaynagi | null;
  /** Deneme cümlesini Orion'un sesiyle söylet (çalındıysa true). */
  dene: (metin: string) => Promise<boolean>;
}

const DENEME_CUMLESI = "Merhaba Ozyn, bu benim sesim. Nasıl duyuluyor?";

export function sesBolumu(a: SesBolumuAyari): AyarBolumu {
  let son: SesDurumu | null = null;
  return {
    id: "ses", ad: "Ses", simge: "🔊", sira: 20, acik: true, ajanlar: ["orion"],
    ipucu: "Orion'un konuşma sesi (Piper): seç, indir, dene — değişiklik bir sonraki cümleden geçerli",
    ozet: () => (!a.kaynak ? "yalnız Electron'da" : son ? (son.sesler.find((s) => s.etkin)?.baslik ?? "ses yok") : ""),
    kur(govde, arac) {
      if (!a.kaynak) {
        govde.append(el("div", "ap-not", "Ses seçimi Electron kabuğunda yapılır (npm start / 3dorion.bat). Tarayıcı geliştirme sayfasında Piper yok."));
        return {};
      }
      const kaynak = a.kaynak;
      const ust = el("div", "ap-satir");
      const deneDugme = dugme("▶ Dene", `Orion bu cümleyi şu anki sesle söyler: "${DENEME_CUMLESI}"`, () => {
        deneDugme.disabled = true;
        void a.dene(DENEME_CUMLESI).then((oldu) => { if (!oldu) mesajYaz("çalınamadı (konsolda [ses] satırına bak)", "ap-hata"); }).finally(() => { deneDugme.disabled = false; });
      });
      ust.append(el("span", "ap-etiket ap-not", "Değişiklik bir sonraki cümleden geçerli."), deneDugme);
      const kilit = el("div", "ap-uyari");
      const satirlar = el("div");
      const mesaj = el("div", "ap-not");
      govde.append(ust, kilit, satirlar, mesaj);

      let ilerleme: SesIndirmeIlerlemesi | null = null;
      let indirilen: string | null = null;
      let silOnayi: { ad: string; saat: ReturnType<typeof setTimeout> } | null = null;
      const mesajYaz = (m: string, sinif = "ap-not") => { mesaj.textContent = m; mesaj.className = sinif; };
      const isle = (is: Promise<SesDurumu>, basari?: string) => is.then((d) => { son = d; if (basari) { mesajYaz(basari, "ap-not ap-iyi"); arac.bildir(basari, 2200); } ciz(); },
        (e: unknown) => { mesajYaz(`olmadı: ${hataMetni(e)}`, "ap-hata"); ciz(); });

      kaynak.indirmeDinle((o) => { ilerleme = o; if (o.ad === indirilen) ciz(); });

      function ciz(): void {
        arac.ozet(son?.sesler.find((s) => s.etkin)?.baslik ?? "");
        if (!son) { satirlar.replaceChildren(el("div", "ap-not", "yükleniyor…")); return; }
        kilit.textContent = [son.kilit, son.uyari, !son.piperVar ? "piper.exe bulunamadı: %LOCALAPPDATA%\\piper\\piper\\piper.exe" : null,
          ...son.bozuk.map((b) => `⚠ ${b.ad}: ${b.neden}`)].filter(Boolean).join(" · ");
        satirlar.replaceChildren(...sesSatirlari(son, ilerleme, indirilen).map((s) => {
          const kok = el("div");
          const ust = el("div", "ap-satir");
          const ad = el("span", "ap-etiket", `${s.etkin ? "● " : ""}${s.baslik}`);
          ad.title = s.ad;
          if (s.etkin) ad.classList.add("ap-iyi");
          ust.append(ad);
          if (s.sec) {
            const d = dugme("Seç", s.sec.acik ? "bu sesle konuş (sonraki cümleden)" : s.sec.neden, () => { void isle(kaynak.sec(s.ad), `ses: ${s.baslik} (sonraki cümleden)`); });
            d.disabled = !s.sec.acik;
            ust.append(d);
          }
          if (s.indir) {
            const d = dugme("İndir", s.indir.acik ? `katalogdan indir (${s.alt})` : s.indir.neden, () => {
              indirilen = s.ad; ilerleme = null; mesajYaz(`${s.baslik} iniyor…`);
              void isle(kaynak.indir(s.ad), `${s.baslik} indirildi — "Seç" ile kullan`).finally(() => { indirilen = null; ciz(); });
              ciz();
            });
            d.disabled = !s.indir.acik;
            ust.append(d);
          }
          if (s.sil) {
            const onayda = silOnayi?.ad === s.ad;
            const d = dugme(onayda ? "Eminim, sil" : "Sil", s.sil.acik ? (onayda ? "iki dosya da silinir (geri alınmaz)" : "indirilen sesi sil") : s.sil.neden, () => {
              if (!onayda) {
                if (silOnayi) clearTimeout(silOnayi.saat);
                silOnayi = { ad: s.ad, saat: setTimeout(() => { silOnayi = null; ciz(); }, 4000) };
                ciz(); return;
              }
              if (silOnayi) clearTimeout(silOnayi.saat);
              silOnayi = null;
              void isle(kaynak.sil(s.ad), `${s.baslik} silindi`);
            });
            d.disabled = !s.sil.acik;
            if (onayda) d.dataset.ton = "uyari";
            ust.append(d);
          }
          kok.append(ust, el("div", "ap-not", s.alt));
          if (s.ilerleme !== null) {
            const cubuk = el("div", "ap-cubuk"); const ic = el("i"); ic.style.width = `${Math.round(s.ilerleme * 100)}%`; cubuk.append(ic);
            kok.append(cubuk);
          }
          return kok;
        }));
      }
      const yenile = () => { void isle(kaynak.liste()); };
      ciz();
      return { goster: yenile };
    },
  };
}
