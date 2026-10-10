// world/level/editor/arayuz/editorArayuzu.ts — Editör ekran düzeni (spec 22).
//
//   ┌──────────────── araç çubuğu: araçlar · eksen · yaslama · geri/ileri · kaydet · kip · yardım ───────────────┐
//   │ SOL: Sahne | Dünya | Geçmiş │                     sahne (tuval)                       │ SAĞ: Özellikler │
//   │                             ├──────────── ALT: Varlıklar | Hazır yapılar ────────────┤                 │
//   └──────────────────────────────── durum çubuğu ──────────────────────────────────────────────────────────────┘
// Yuvalar kenarından boyutlanır (boyut tarayıcıda saklanır), araç çubuğundaki ◧ ⬓ ◨ ile gizlenir. Tuval tam ekran
// kalır (yuvalar üstünde): kamera ve ışın hesapları yuvaya göre değişmez. Uçuş kipinde (Tab) hepsi gizlenir.
"use strict";
import type { Editor } from "../editor.ts";
import type { ModulKaydi } from "../../cekirdek/levelKur.ts";
import type { ShaderKaydi } from "../../shader/shaderSistemi.ts";
import type { NesneYeri } from "../../cekirdek/levelTanimi.ts";
import { parcaOku } from "../cekirdek/pano.ts";
import { VarHatasi, type LevelDeposu } from "../../depo/levelDeposu.ts";
import { levelMenusuKur } from "./levelMenusu.ts";
import { AYAR_VARSAYILAN, type EditorAyarlari } from "../cekirdek/durum.ts";
import { YASLAMA_VARSAYILAN } from "../cekirdek/yaslama.ts";
import { FIRCA_VARSAYILAN } from "../cekirdek/firca.ts";
import { ARAZI_VARSAYILAN } from "../cekirdek/araziKomutu.ts";
import { levelPaneliKur } from "../levelPaneli.ts";
import { el, cssKur, cssEkle, boyutTutamagi, oku, yaz } from "./ortak.ts";
import { aracCubuguKur } from "./aracCubugu.ts";
import { sahneAgaciKur } from "./sahneAgaci.ts";
import { ozelliklerKur } from "./ozellikler.ts";
import { varlikTarayicisiKur, type HazirKaynagi } from "./varlikTarayici.ts";
import { durumCubuguKur } from "./durumCubugu.ts";
import { yardimKur } from "./yardim.ts";
import { gorunumKur } from "./gorunum.ts";

const AYAR_ANAHTARI = "orion.editor.ayarlar";
const YUVA_ANAHTARI = "orion.editor.yuvalar";

/** Saklanan editör ayarları (eksik alanlar varsayılandan; eski kayıt yeni alanı bozmaz). */
export function editorAyarlariniOku(): EditorAyarlari {
  const a = oku<EditorAyarlari>(AYAR_ANAHTARI, AYAR_VARSAYILAN);
  return { ...AYAR_VARSAYILAN, ...a, yaslama: { ...YASLAMA_VARSAYILAN, ...a.yaslama }, firca: { ...FIRCA_VARSAYILAN, ...a.firca }, arazi: { ...ARAZI_VARSAYILAN, ...a.arazi } };
}

const L_CSS = `
#ed-sol { left: 0; top: var(--ed-ust); bottom: var(--ed-alt); border-right: 1px solid var(--ed-cizgi); }
#ed-sag { right: 0; top: var(--ed-ust); bottom: var(--ed-alt); border-left: 1px solid var(--ed-cizgi); }
#ed-altyuva { bottom: var(--ed-alt); border-top: 1px solid var(--ed-cizgi); }
.ed-yuva.gizli { display: none; }
.ed-gecmis .s { padding: 3px 10px; cursor: pointer; border-bottom: 1px solid #161d2c; }
.ed-gecmis .s:hover { background: #18213a; }
.ed-gecmis .s.simdi { color: var(--ed-uyari); cursor: default; }
.ed-gecmis .s.ileri { color: var(--ed-soluk); font-style: italic; cursor: default; }
#olcum { display: none; }
`;

export interface ArayuzAyari {
  /** Açık level'ın klasör adı (world/level/<ad>/). */
  ad: string;
  /** Level ve hazır yapı dosyaları (kompozisyon kökü seçer: geliştirmede HTTP). */
  depo: LevelDeposu;
  moduller: ModulKaydi;
  shaderlar: ShaderKaydi;
}

export function editorArayuzuKur(ed: Editor, a: ArayuzAyari): void {
  cssKur();
  cssEkle("edLayoutStil", L_CSS);
  const { durum } = ed;
  const { tuval } = ed;
  const yuvalar = oku(YUVA_ANAHTARI, { sol: true, sag: true, alt: true });
  const boy = { sol: 300, sag: 280, alt: 210 };

  // ── yuvalar ──
  const yuva = (id: string, baslikCocuklari: HTMLElement[]) => {
    const y = el("div", "ed-yuva ed-kok"); y.id = id;
    const bas = el("div", "ed-yuva-bas"); bas.append(...baslikCocuklari);
    const govde = el("div", "ed-yuva-govde");
    y.append(bas, govde);
    document.body.append(y);
    return { y, bas, govde };
  };
  let kuruldu = false;   // tutamaklar kurulurken boyutu hemen bildirir; yuvaların hepsi olunca yerleştir
  const yerlestir = () => {
    if (!kuruldu) return;
    const sol = yuvalar.sol ? boy.sol : 0, sag = yuvalar.sag ? boy.sag : 0;
    solY.y.style.width = `${boy.sol}px`; sagY.y.style.width = `${boy.sag}px`;
    altY.y.style.left = `${sol}px`; altY.y.style.right = `${sag}px`; altY.y.style.height = `${boy.alt}px`;
    solY.y.classList.toggle("gizli", !yuvalar.sol); sagY.y.classList.toggle("gizli", !yuvalar.sag); altY.y.classList.toggle("gizli", !yuvalar.alt);
  };

  // Sol: sekmeler.
  const sekmeler = ["Sahne", "Dünya", "Geçmiş"] as const;
  const sekmeDugmeleri = sekmeler.map((s) => el("button", "ed-sekme", s));
  const solY = yuva("ed-sol", sekmeDugmeleri);
  const agac = sahneAgaciKur(ed, (katman) => { sekmeSec("Dünya"); panel.bolumAc(`katman:${katman}`); });
  const panel = levelPaneliKur({ durum, moduller: a.moduller, shaderlar: a.shaderlar });
  const dunya = el("div"); dunya.style.cssText = "display:flex;flex-direction:column;flex:1;min-height:0;overflow:auto";
  dunya.append(gorunumKur(ed, a.shaderlar), panel.kok);
  const gecmis = el("div", "ed-gecmis");
  const sekmeIcerik = { Sahne: agac.kok, Dünya: dunya, Geçmiş: gecmis };
  let etkinSekme = oku<{ s: (typeof sekmeler)[number] }>("orion.editor.sekme", { s: "Sahne" }).s;
  const sekmeSec = (s: (typeof sekmeler)[number]) => {
    etkinSekme = s; yaz("orion.editor.sekme", { s });
    sekmeDugmeleri.forEach((d, i) => d.classList.toggle("secili", sekmeler[i] === s));
    solY.govde.replaceChildren(sekmeIcerik[s]);
    if (s === "Geçmiş") gecmisCiz();
  };
  sekmeDugmeleri.forEach((d, i) => { d.onclick = () => { sekmeSec(sekmeler[i]!); d.blur(); }; });
  boyutTutamagi(solY.y, "sag", "orion.editor.solBoy", boy.sol, 220, 560, (v) => { boy.sol = v; yerlestir(); });

  // Geçmiş: en yeni üstte; bir satıra tıkla → o adıma kadar geri al.
  const gecmisCiz = () => {
    if (etkinSekme !== "Geçmiş") return;
    const g = durum.gecmisSayisi();
    const satirlar: HTMLElement[] = [];
    for (let i = 0; i < g.ileri; i++) satirlar.push(el("div", "s ileri", `↷ ileri alınabilir adım ${g.ileri - i}`));
    satirlar.push(el("div", "s simdi", "● şu an"));
    g.mesajlar.slice().reverse().forEach((m, i) => {
      const s = el("div", "s", m);
      s.title = `buraya kadar geri al (${i + 1} adım)`;
      s.onclick = () => { for (let k = 0; k <= i; k++) durum.geriAl(); };
      satirlar.push(s);
    });
    if (!g.mesajlar.length && !g.ileri) satirlar.push(el("div", "ed-ipucu", "Henüz değişiklik yok."));
    gecmis.replaceChildren(...satirlar);
  };
  durum.abone("gecmis", gecmisCiz);

  // Sağ: özellikler.
  const sagY = yuva("ed-sag", [el("b", "", "Özellikler")]);
  const oz = ozelliklerKur(ed);
  sagY.govde.append(oz.kok);
  boyutTutamagi(sagY.y, "sol", "orion.editor.sagBoy", boy.sag, 220, 520, (v) => { boy.sag = v; yerlestir(); });

  // Alt: varlık tarayıcısı (+ hazır yapılar).
  // Hazır yapılar depodan (yazılabilir depoda): içerik okunurken parça biçimi doğrulanır.
  const hazir: HazirKaynagi | null = a.depo.yazilabilir ? {
    liste: () => a.depo.hazirListe(),
    oku: async (ad) => parcaOku(await a.depo.hazirOku(ad)),
  } : null;
  const altY = yuva("ed-altyuva", []);
  const tarayici = varlikTarayicisiKur(ed, hazir);
  altY.bas.remove();
  altY.govde.append(tarayici.kok);
  boyutTutamagi(altY.y, "ust", "orion.editor.altBoy", boy.alt, 120, 520, (v) => { boy.alt = v; yerlestir(); });

  // Hazır yapı olarak kaydet (özellikler paneline bölüm).
  oz.ekle((sec: NesneYeri[]) => {
    if (!hazir || !sec.length) return null;
    const b = el("div", "ed-bolum");
    b.append(el("h4", "", "Hazır yapı"));
    const r = el("div"); r.style.cssText = "display:flex;gap:4px";
    const ad = el("input"); ad.type = "text"; ad.placeholder = "ad (ör. köşe-dükkan)"; ad.style.flex = "1";
    ad.onkeydown = (e) => e.stopPropagation();
    const kaydet = el("button", "", "Kaydet");
    kaydet.title = "Seçili nesneleri hazır yapı olarak kaydet (world/level/hazir/) — varlık tarayıcısında 'Hazır yapılar'";
    kaydet.onclick = async () => {
      const temiz = ad.value.trim().toLocaleLowerCase("tr").replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "");
      if (!temiz) { durum.bildir("hazır yapıya bir ad ver", true); return; }
      const p = ed.parca(temiz);
      if (!p) return;
      const gonder = (ez: boolean) => a.depo.hazirKaydet(temiz, p, ez);
      try {
        let yol: string;
        try { yol = await gonder(false); } catch (err) {
          if (!(err instanceof VarHatasi) || !confirm(`"${temiz}" zaten var. Üstüne yazılsın mı?`)) throw err;
          yol = await gonder(true);
        }
        durum.bildir(`hazır yapı kaydedildi → ${yol}`);
        tarayici.hazirlariYenile();
      } catch (err) { if (!(err instanceof VarHatasi)) durum.bildir(`kaydedilemedi: ${err instanceof Error ? err.message : String(err)}`, true); }
    };
    r.append(ad, kaydet);
    b.append(r, el("div", "ed-ipucu", `${sec.length} nesne · konumlar seçimin taban ortasına göre saklanır`));
    return b;
  });

  aracCubuguKur(ed, a.ad);
  // Araç çubuğuna yuva düğmeleri.
  const ust = document.getElementById("ed-ust")!;
  const yuvaDugmesi = (yazi: string, baslik: string, k: keyof typeof yuvalar) => {
    const d = el("button", yuvalar[k] ? "secili" : "", yazi); d.title = baslik;
    d.onclick = () => { yuvalar[k] = !yuvalar[k]; yaz(YUVA_ANAHTARI, yuvalar); d.classList.toggle("secili", yuvalar[k]); yerlestir(); d.blur(); };
    return d;
  };
  ust.append(el("span", "ayrac"), yuvaDugmesi("◧", "Sol yuva (sahne ağacı / dünya / geçmiş)", "sol"), yuvaDugmesi("⬓", "Alt yuva (varlıklar)", "alt"), yuvaDugmesi("◨", "Sağ yuva (özellikler)", "sag"));

  durumCubuguKur(ed, ed.sahne, () => ed.imlec());
  const yardim = yardimKur();

  // Kutu seçimi dikdörtgeni.
  const kutu = el("div"); kutu.id = "ed-kutu"; document.body.append(kutu);
  ed.kancalar.secimKutusu = (k) => {
    if (!k) { kutu.style.display = "none"; return; }
    const r = tuval.getBoundingClientRect();
    Object.assign(kutu.style, { display: "block", left: `${r.left + Math.min(k.x0, k.x1)}px`, top: `${r.top + Math.min(k.y0, k.y1)}px`, width: `${Math.abs(k.x1 - k.x0)}px`, height: `${Math.abs(k.y1 - k.y0)}px` });
  };
  ed.kancalar.yardim = () => yardim.acKapa();
  ed.kancalar.varlikAra = () => { if (!yuvalar.alt) { yuvalar.alt = true; yerlestir(); } tarayici.araOdakla(); };

  // Varlık kartı tuvale sürüklenip bırakılınca.
  {
    const nokta = (e: DragEvent) => { const r = tuval.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    tuval.addEventListener("dragover", (e) => { if (!ed.yerlestiriliyor()) return; e.preventDefault(); const p = nokta(e); ed.disaridanSurukle(p.x, p.y); });
    tuval.addEventListener("drop", (e) => { if (!ed.yerlestiriliyor()) return; e.preventDefault(); const p = nokta(e); ed.disaridanBirak(p.x, p.y); });
    addEventListener("dragend", (e) => { if (e.dataTransfer?.dropEffect === "none" && ed.yerlestiriliyor()) ed.yerlestirmeyiBitir(); });
  }

  // Uçuş kipi.
  const ucusIpucu = el("div"); ucusIpucu.id = "ed-ucus-ipucu"; ucusIpucu.textContent = "UÇUŞ — tıkla: fareyi kilitle · WASD + fare · Space/E yukarı · Q/C aşağı · Tab: editöre dön";
  document.body.append(ucusIpucu);
  const kipYaz = () => document.body.classList.toggle("ed-ucus", durum.kip() === "ucus");
  durum.abone("kip", kipYaz);
  kipYaz();

  // Ayarlar saklanır; kaydedilmemiş değişiklikle sayfadan çıkılırken sor.
  durum.abone("ayarlar", () => yaz(AYAR_ANAHTARI, durum.ayarlar()));
  const menu = levelMenusuKur(ed, a.depo, a.ad);
  addEventListener("beforeunload", (e) => { if (durum.kirli() && !menu.gecisSuruyor()) e.preventDefault(); });

  sekmeSec(etkinSekme);
  kuruldu = true;
  yerlestir();
}

