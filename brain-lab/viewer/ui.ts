// brain-lab/viewer/ui.ts — small DOM helpers shared by the lab pages (browser only).
"use strict";

import { TERMS, guideLink } from "./guide.ts";

/** Text from the data is always escaped before it goes into HTML. */
export const esc = (s: unknown): string =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A small "?" that shows the guide's one-line explanation on hover and opens the full entry on click. */
export function tip(id: string): string {
  const t = TERMS.get(id);
  if (!t) throw new Error(`guide has no term ${id}`);
  return `<a class="tip" href="${guideLink(id)}" target="_blank" title="${esc(`${t.term}: ${t.short}`)}">?</a>`;
}

export function byId<T extends Element = HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`missing element #${id}`);
  return e as unknown as T;
}

export async function api<T>(path: string): Promise<T> {
  const r = await fetch(path);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${path}: ${r.status} ${(body as { error?: string }).error ?? ""}`);
  return body as T;
}

/** Turkish decimal comma, fixed digits. */
export const num = (x: number, digits = 2): string => x.toFixed(digits).replace(".", ",");
export const pct = (x: number): string => `%${Math.round(100 * x)}`;
export const pText = (p: number): string => (p < 0.001 ? "< 0,001" : num(p, 3));

export function showError(e: unknown): void {
  const box = document.createElement("div");
  box.className = "panel error";
  box.style.marginBottom = "14px";
  box.textContent = `Veri okunamadı: ${e instanceof Error ? e.message : String(e)}. Sunucu açık mı? (npm run lab)`;
  document.querySelector("main")!.prepend(box);
}

/** The page tabs, the same on every page; `here` is the current page's file. */
export function tabs(here: string): string {
  const pages: [string, string][] = [
    ["deney-odasi.html", "Deney Odası"], ["deneyler.html", "Sonuçlar"], ["guide.html", "Rehber"], ["index.html", "Beyin haritası"],
  ];
  return pages.map(([href, label]) => `<a href="./${href}"${href === here ? ' class="here"' : ""}>${label}</a>`).join("");
}
