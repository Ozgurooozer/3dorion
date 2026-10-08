// world/level/editor/inspektor.ts — Babylon Inspector'ı (canlı sahne düzenleyici) aç/kapa. YALNIZ geliştirmede.
//
// Inspector büyük (React + Babylon editörleri) ve yalnız geliştirme aracı: dinamik import, `import.meta.env.DEV`
// değilse hiç yüklenmez — son pakete girmez. Inspector'da yapılan değişiklik KAYDEDİLMEZ (keşif içindir);
// kalıcı ayar level panelinden tanım dosyasına yazılır.
"use strict";
import type { Scene } from "@babylonjs/core/scene";

export async function inspektorAcKapa(sahne: Scene): Promise<boolean> {
  if (!import.meta.env.DEV) return false;
  await import("@babylonjs/core/Debug/debugLayer");
  await import("@babylonjs/inspector");
  if (sahne.debugLayer.isVisible()) { sahne.debugLayer.hide(); return false; }
  await sahne.debugLayer.show({ embedMode: true, overlay: true });
  return true;
}
