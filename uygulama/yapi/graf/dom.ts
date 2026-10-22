// uygulama/yapi/graf/dom.ts — GÖRSEL EDİTÖRÜN küçük DOM yardımcıları (spec 35 dilim 2b): öğe, düğme, ayar alanı girdisi. DOM katmanı.
//
// Ayar alanı girdisi düğümün içinde (satır içi) ve Ayrıntılar panelinde AYNI işlevden: tür (sayı/metin/bool, seçenekli liste) `alanlar.ts`in tanımından,
// yazılanın değere çevrilmesi ve doğrulaması da orada (sayı eval EDİLMEZ). Burada yalnız girdi öğesi kurulur; değişiklik `change` ile (her tuşta değil:
// yazarken grafiğe her harf ayrı geri al adımı olmasın).
"use strict";
import type { GrafDegeri } from "../../../protocol/graf.ts";
import { alanYazisi, type AlanTanimi } from "../../graf/editor/alanlar.ts";
import { dugmeYap, el, yaziAlaniMi } from "../ortak/dom.ts";

// Ortak yardımcılar (sekans editörüyle paylaşılır; spec 36): `el`, `yaziAlaniMi` burada yeniden dışa verilir, graf parçaları eskisi gibi buradan alır.
export { el, yaziAlaniMi };

export const dugme = dugmeYap("ge-dugme");

/**
 * Ayar alanının girdisi. `degisti(ham)` kullanıcı değeri bitirince (Enter, odak kaybı, seçim) çağrılır; kabul edilmezse çağıran `geriYukle` ile eski
 * değeri geri koyar. Geçerli değer seçeneklerde yoksa (bozuk JSON) listeye "(geçersiz) x" olarak eklenir: değer gizlenmesin.
 */
export function alanGirdisi(a: AlanTanimi, deger: GrafDegeri | undefined, degisti: (ham: string | boolean) => void): HTMLElement {
  if (a.tip === "bool") {
    const c = el("input"); c.type = "checkbox";
    c.checked = (deger ?? a.varsayilan) === true;
    c.addEventListener("change", () => degisti(c.checked));
    return c;
  }
  if (a.secenekler) {
    const s = el("select", "ge-alan");
    const mevcut = deger === undefined || deger === null ? (a.varsayilan === undefined ? null : String(a.varsayilan)) : String(deger);
    if (mevcut === null) { const o = el("option", "", "— seç —"); o.value = "\u0000"; o.disabled = true; o.selected = true; s.append(o); }
    else if (!a.secenekler.includes(mevcut)) { const o = el("option", "", `(geçersiz) ${mevcut}`); o.value = mevcut; o.selected = true; s.append(o); }
    for (const x of a.secenekler) { const o = el("option", "", x === "" ? "(hepsi / boş)" : x); o.value = x; if (x === mevcut) o.selected = true; s.append(o); }
    s.addEventListener("change", () => { if (s.value !== "\u0000") degisti(s.value); });
    return s;
  }
  const i = el("input", "ge-alan");
  i.type = "text"; i.spellcheck = false; i.autocomplete = "off";
  i.value = alanYazisi(deger);
  i.placeholder = a.varsayilan !== undefined && a.varsayilan !== null ? String(a.varsayilan) : a.tip === "sayi" ? "sayı" : "";
  if (a.tip === "sayi") i.inputMode = "decimal";
  i.title = `${a.ad}${a.aciklama ? ` — ${a.aciklama}` : ""}${a.en !== undefined || a.cok !== undefined ? ` (${a.en ?? "-∞"}–${a.cok ?? "∞"})` : ""}`;
  i.addEventListener("change", () => degisti(i.value));
  i.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); i.blur(); } });
  return i;
}
