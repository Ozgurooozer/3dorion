// host/ses.d.ts — `ses.js` için tip bildirimi (Electron ana süreci .js'i doğrudan yüklüyor; test ve tipler buradan).
export function piperBul(): { exe: string | null; model: string | null };
/** Test için sahte süreç: `child_process.spawn` ile aynı imza (yalnız kullanılan alanlar). */
export type SurecAcici = (exe: string, argv: readonly string[], secenek: object) => {
  stdin: { write(veri: string): unknown; end(): unknown };
  stdout: { setEncoding(k: string): unknown; on(olay: "data", f: (parca: string) => void): unknown };
  stderr: { setEncoding(k: string): unknown; on(olay: "data", f: (parca: string) => void): unknown };
  on(olay: "error" | "exit", f: (x: unknown) => void): unknown;
  kill(): unknown;
};
export class PiperSesi {
  constructor(ciktiDizini?: string, secenek?: { exe?: string | null; model?: string | null; surecAc?: SurecAcici; hazirBeklemeMs?: number });
  kullanilabilir(): boolean;
  readonly model: string | null;
  modelAyarla(yol: string | null): void;
  uret(metin: string): Promise<{ ok: true; yol: string } | { ok: false; hata: string }>;
  kapat(): void;
}
