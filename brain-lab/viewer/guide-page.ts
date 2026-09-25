// brain-lab/viewer/guide-page.ts — renders the guide (guide.ts) as a page: a table of contents and one card
// per term, each anchor-linkable so the "?" hints on the other pages land on the right entry.
"use strict";

import { GUIDE, MEAL_REFERENCES, type Term } from "./guide.ts";
import { byId, esc, num, tabs } from "./ui.ts";

const paragraphs = (text: string) => text.split("\n\n").map((p) => `<p>${esc(p)}</p>`).join("");

function card(t: Term): string {
  const facts = [
    t.read ? `<div class="fact read"><div class="k">Nasıl okunur</div>${esc(t.read)}</div>` : "",
    t.target ? `<div class="fact target"><div class="k">Hedef ve neden</div>${esc(t.target)}</div>` : "",
  ].join("");
  const refs = t.id === "yemek"
    ? `<table style="margin-top:10px"><thead><tr><th>karşılaştırma noktası</th><th class="num">yemek / 1000 tik</th><th>ne</th></tr></thead><tbody>${
      MEAL_REFERENCES.map((r) => `<tr><td>${esc(r.who)}</td><td class="num">${num(r.perK)}</td><td class="dim">${esc(r.note)}</td></tr>`).join("")
    }</tbody></table>`
    : "";
  return `<article class="term-card" id="${esc(t.id)}">
    <h3>${esc(t.term)}</h3>
    <div class="short">${esc(t.short)}</div>
    ${paragraphs(t.long)}
    ${facts ? `<div class="facts">${facts}</div>` : ""}
    ${refs}
  </article>`;
}

byId("tabs").innerHTML = tabs("guide.html");
byId("toc").innerHTML = GUIDE.map((s) =>
  `<a class="sec" href="#${esc(s.id)}">${esc(s.title)}</a>${s.terms.map((t) => `<a class="term" href="#${esc(t.id)}">${esc(t.term)}</a>`).join("")}`,
).join("");
byId("sections").innerHTML = GUIDE.map((s) =>
  `<section class="panel" id="${esc(s.id)}"><h2>${esc(s.title)}</h2><div class="intro">${esc(s.intro)}</div>${s.terms.map(card).join("")}</section>`,
).join("");
// The cards are rendered after load, so the browser's own jump to #term happened too early: repeat it.
if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
