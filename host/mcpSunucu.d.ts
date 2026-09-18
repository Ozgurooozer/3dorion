// host/mcpSunucu.d.ts — `mcpSunucu.js` için tip bildirimi (Electron ana
// süreci .js'i doğrudan yüklüyor; testler TS).
export interface McpSunucu {
  port: number;
  hazir: Promise<void>;
  kapat(): void;
}
export function mcpSunucuKur(ayar: {
  port: number;
  /** `sinyal`: istemci bağlantıyı koparırsa (ajan öldü) iptal edilir. */
  role: (yontem: string, param: unknown, sinyal?: AbortSignal) => Promise<unknown>;
  releSiniriMs?: number;
  /** MCP `initialize` — yeni ajan oturumu (talimat yeniden gitsin). */
  oturumBasladi?: () => void;
}): McpSunucu;
