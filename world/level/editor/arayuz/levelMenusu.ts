// world/level/editor/arayuz/levelMenusu.ts — Level menüsü ve kurtarma şeridi (spec 23 A).
//
// Araç çubuğundaki level adına tıkla: Aç (liste) · Yeni (şablondan ya da bu level'ın kopyası) · Farklı kaydet ·
// Dosyadan yeniden yükle. Level değiştirmek sayfayı `?level=` ile YENİDEN YÜKLER (sahne durumu sızmasın);
// kaydedilmemiş değişiklik varsa önce sorar. Bütün dosya işleri depodan (depo/levelDeposu.ts) geçer.
//
// Kurtarma (cekirdek/kurtarma.ts): kirliyken 3 sn sessizlikte tanımın kopyası tarayıcıya yazılır, kaydedince
// silinir; açılışta kopya dosyadan farklıysa şerit: [Kurtar] (tek geri al adımı) · [Sil].
"use strict";
import type { Editor } from "../editor.ts";
import type { LevelTanimi } from "../../cekirdek/levelTanimi.ts";
import { adDuzelt, VarHatasi, type LevelDeposu, type LevelOzeti } from "../../depo/levelDeposu.ts";
import { kurtarmaKaydi, kurtarmaOnerisi, tanimImzasi, type KurtarmaDeposu } from "../cekirdek/kurtarma.ts";
import { el, cssEkle } from "./ortak.ts";

const M_CSS = `
#ed-level-menu { position: fixed; left: 8px; top: calc(var(--ed-ust) + 4px); width: 340px; max-height: 70vh; overflow: auto; z-index: 25;
  background: #0e131e; border: 1px solid var(--ed-cizgi); border-radius: 8px; display: none; box-shadow: 0 6px 24px rgba(0,0,0,.45); }
#ed-level-menu.acik { display: block; }
#ed-level-menu .s { display: grid; grid-template-columns: 1fr auto; gap: 6px; padding: 4px 10px; cursor: pointer; }
#ed-level-menu .s:hover { background: #18213a; }
#ed-level-menu .s.simdi { color: var(--ed-uyari); cursor: default; }
#ed-level-menu .s small { color: var(--ed-soluk); }
#ed-level-menu .form { display: grid; gap: 4px; }
#ed-level-menu .form input[type=text], #ed-level-menu .form select { width: 100%; }
#ed-level-menu .hata { color: var(--ed-hata); font-size: 11px; min-height: 14px; }
#ed-kurtarma { position: fixed; left: 50%; top: calc(var(--ed-ust) + 6px); transform: translateX(-50%); z-index: 24; display: none;
  background: #3a2c10; border: 1px solid var(--ed-uyari); color: #ffe9b8; padding: 6px 10px; border-radius: 8px; gap: 8px; align-items: center; }
#ed-kurtarma.acik { display: flex; }
`;

export interface LevelMenusu {
  /** Sayfadan bilerek ayrılınıyor (level değiştirme): "kaydedilmemiş" uyarısı sorulmaz. */
  gecisSuruyor(): boolean;
}

/** Tarayıcı deposu: anahtar başına bir kurtarma kaydı. Erişim yasaklıysa (özel pencere) sessizce yok. */
export function tarayiciKurtarmaDeposu(): KurtarmaDeposu {
  const anahtar = (ad: string) => `orion.editor.kurtarma.${ad}`;
  return {
    oku(ad) { try { const h = localStorage.getItem(anahtar(ad)); return h ? JSON.parse(h) as unknown : null; } catch { return null; } },
    yaz(ad, k) { try { localStorage.setItem(anahtar(ad), JSON.stringify(k)); } catch { /* kota/özel pencere: kurtarma yok */ } },
    sil(ad) { try { localStorage.removeItem(anahtar(ad)); } catch { /* */ } },
  };
}

const tarih = (ms: number) => new Date(ms).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function levelMenusuKur(ed: Editor, depo: LevelDeposu, ad: string, kurtarmaDeposu: KurtarmaDeposu = tarayiciKurtarmaDeposu()): LevelMenusu {
  cssEkle("edLevelMenuStil", M_CSS);
  const { durum } = ed;
  let gecis = false;

  // ── geçiş ──
  const git = (yeniAd: string, sor = true) => {
    if (sor && durum.kirli() && !confirm(`"${ad}" level'ında kaydedilmemiş değişiklik var. Kaydetmeden geçilsin mi? (Kurtarma kopyası kalır.)`)) return;
    gecis = true;
    const q = new URLSearchParams(location.search);
    q.set("level", yeniAd); q.delete("aci");
    location.search = q.toString();
  };

  // ── menü ──
  const menu = el("div", "ed-kok"); menu.id = "ed-level-menu";
  document.body.append(menu);
  const bolum = (baslik: string, ...cocuk: HTMLElement[]) => { const b = el("div", "ed-bolum"); b.append(el("h4", "", baslik), ...cocuk); return b; };
  const hataSatiri = () => el("div", "hata");

  const listeKap = el("div");
  const listeCiz = (l: LevelOzeti[]) => {
    listeKap.replaceChildren(...l.map((o) => {
      const s = el("div", `s${o.ad === ad ? " simdi" : ""}`);
      s.append(el("span", "", o.ad === ad ? `● ${o.ad}` : o.ad), el("small", "", `${(o.bayt / 1024).toFixed(0)} KB · ${tarih(o.degisme)}`));
      s.title = o.ad === ad ? "açık olan level" : `${o.ad} level'ını aç`;
      if (o.ad !== ad) s.onclick = () => git(o.ad);
      return s;
    }));
    if (!l.length) listeKap.append(el("div", "ed-ipucu", "level yok"));
  };

  /** Yeni level tanımı: şablondan ya da bu level'dan (nesneli/nesnesiz); görünen ad yazılan metin. */
  const yeniTanim = async (kaynak: string, nesneli: boolean, gorunenAd: string): Promise<LevelTanimi> => {
    const t: LevelTanimi = kaynak === "@bu" ? structuredClone(durum.tanim()) : (await depo.sablonOku(kaynak)) as LevelTanimi;
    const y: LevelTanimi = { ...t, ad: gorunenAd };
    if (kaynak === "@bu" && !nesneli) { y.nesneler = []; y.gruplar = []; }
    return y;
  };
  const olusturFormu = (dugmeYazi: string, kaynakSecimi: boolean, isle: (slug: string, metin: string, kaynak: string, nesneli: boolean) => Promise<void>) => {
    const f = el("div", "form");
    const ad1 = el("input"); ad1.type = "text"; ad1.placeholder = "ad (ör. Liman Gece)";
    ad1.onkeydown = (e) => e.stopPropagation();
    const ipucu = el("div", "ed-ipucu", "klasör: —");
    ad1.oninput = () => { ipucu.textContent = `klasör: ${adDuzelt(ad1.value) || "—"}`; };
    const sec = el("select");
    const nesneli = el("label"); const c = el("input"); c.type = "checkbox"; nesneli.append(c, document.createTextNode(" nesneleriyle"));
    if (kaynakSecimi) {
      sec.add(new Option(`bu level'ın kopyası (${ad})`, "@bu"));
      void depo.sablonlar().then((l) => { for (const s of l) sec.add(new Option(`şablon: ${s}`, s)); }).catch(() => undefined);
      sec.onchange = () => { nesneli.style.display = sec.value === "@bu" ? "" : "none"; };
    }
    const hata = hataSatiri();
    const dugme = el("button", "ana", dugmeYazi);
    dugme.onclick = async () => {
      const slug = adDuzelt(ad1.value);
      if (!slug) { hata.textContent = "bir ad yaz (harf ya da rakam)"; return; }
      dugme.disabled = true; hata.textContent = "";
      try { await isle(slug, ad1.value.trim(), kaynakSecimi ? sec.value : "@bu", c.checked); }
      catch (err) { hata.textContent = err instanceof VarHatasi ? `"${slug}" adında level zaten var` : err instanceof Error ? err.message : String(err); }
      finally { dugme.disabled = false; }
    };
    f.append(ad1, ipucu, ...(kaynakSecimi ? [sec, nesneli] : []), dugme, hata);
    return f;
  };

  const yeniFormu = olusturFormu("Oluştur ve aç", true, async (slug, metin, kaynak, nesneli) => {
    await depo.olustur(slug, await yeniTanim(kaynak, nesneli, metin));
    git(slug);
  });
  const farkliFormu = olusturFormu("Farklı kaydet ve aç", false, async (slug, metin) => {
    await depo.olustur(slug, { ...durum.tanim(), ad: metin });
    // Değişiklikler artık yeni level'da: bu level'ın kurtarma kopyası ve "kaydedilmedi" uyarısı düşer.
    kurtarmaDeposu.sil(ad);
    git(slug, false);
  });
  const yenidenYukle = el("button", "", "Dosyadan yeniden yükle");
  yenidenYukle.title = "Diskteki dosyayı yeniden oku (kaydedilmemiş değişiklikler geri alınabilir bir adımla gider)";
  yenidenYukle.onclick = async () => {
    try {
      const t = await depo.oku(ad);
      if (durum.degistir(() => t as LevelTanimi, "dosyadan yeniden yüklendi")) durum.kaydedildi();
    } catch (err) { durum.bildir(err instanceof Error ? err.message : String(err), true); }
    menu.classList.remove("acik");
  };
  menu.append(
    bolum("Level'lar", listeKap),
    ...(depo.yazilabilir ? [bolum("Yeni level", yeniFormu), bolum("Farklı kaydet", farkliFormu)] : [el("div", "ed-ipucu", "Bu depo salt-okunur.")]),
    bolum("Dosya", yenidenYukle),
  );

  const acKapa = () => {
    const acilacak = !menu.classList.contains("acik");
    menu.classList.toggle("acik", acilacak);
    if (acilacak) depo.liste().then(listeCiz).catch((err: unknown) => { listeKap.replaceChildren(el("div", "hata", err instanceof Error ? err.message : String(err))); });
  };
  const baslik = document.getElementById("ed-level-adi");
  if (baslik) { baslik.onclick = acKapa; baslik.title = "Level menüsü: aç, yeni, farklı kaydet"; }
  addEventListener("pointerdown", (e) => { if (menu.classList.contains("acik") && !menu.contains(e.target as Node) && e.target !== baslik && !baslik?.contains(e.target as Node)) menu.classList.remove("acik"); });

  // ── kurtarma ──
  const temel = tanimImzasi(durum.tanim());
  const oneri = kurtarmaOnerisi(kurtarmaDeposu.oku(ad), durum.tanim());
  if (oneri) {
    const serit = el("div", "ed-kok"); serit.id = "ed-kurtarma"; serit.classList.add("acik");
    const fark = oneri.nesneFarki ? ` · ${oneri.nesneFarki > 0 ? "+" : ""}${oneri.nesneFarki} nesne` : "";
    serit.append(el("span", "", `Kaydedilmemiş değişiklik bulundu (${tarih(oneri.kayit.zaman)}${fark})${oneri.dosyaDegisti ? " — DİKKAT: dosya o zamandan beri başka yerden kaydedilmiş" : ""}`));
    const kurtar = el("button", "ana", "Kurtar"), sil = el("button", "", "Sil");
    kurtar.title = "Kopyayı uygula (geri alınabilir); kaydetmek için Ctrl+S";
    kurtar.onclick = () => { durum.degistir(() => oneri.kayit.tanim, "kurtarıldı (kaydedilmemiş kopya)"); serit.remove(); };
    sil.onclick = () => { kurtarmaDeposu.sil(ad); serit.remove(); durum.bildir("kurtarma kopyası silindi"); };
    serit.append(kurtar, sil);
    document.body.append(serit);
  }
  // Kirliyken 3 sn sessizlikte kopya; kaydedilince (kirli değil) sil.
  let zamanlayici: ReturnType<typeof setTimeout> | null = null;
  const planla = () => {
    if (zamanlayici) clearTimeout(zamanlayici);
    zamanlayici = setTimeout(() => {
      zamanlayici = null;
      const k = kurtarmaKaydi(durum.tanim(), durum.kirli(), temel, Date.now());
      if (k) kurtarmaDeposu.yaz(ad, k); else kurtarmaDeposu.sil(ad);
    }, 3000);
  };
  durum.abone("tanim", planla);
  durum.abone("kirli", () => { if (!durum.kirli()) { if (zamanlayici) clearTimeout(zamanlayici); zamanlayici = null; kurtarmaDeposu.sil(ad); } else planla(); });

  return { gecisSuruyor: () => gecis };
}
