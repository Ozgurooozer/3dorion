// host/icerik.d.ts — `icerik.js` için tip bildirimi (Electron ana süreci .js'i doğrudan yüklüyor; test ve tipler buradan).
export type KokAdi = "Content" | "Engine";
export const KOKLER: readonly KokAdi[];
export const SILINENLER: string;
export const IKILI_TAVAN: number;
export const ICE_AKTAR_TAVAN: number;
export const ICE_AKTAR_UZANTILARI: readonly string[];
export type Kokler = Partial<Record<KokAdi, string>>;
export function adGecerli(ad: unknown): ad is string;
/** Hata `kod`u: gecersiz-adres. */
export function adresParcalari(adres: unknown): string[];
/** Hata `kod`ları: gecersiz-adres | salt-okunur | kok-yok. */
export function adresCoz(kokler: Kokler, adres: unknown, secenek?: { yazma?: boolean }): { kok: KokAdi; parcalar: string[]; tam: string; adres: string };
export const ustAdres: (adres: string) => string;
export interface IcerikOgesi { adres: string; klasor: boolean; boyut: number; degisti: number }
export function icerikListe(kokler: Kokler, kok: KokAdi): { kok: KokAdi; ogeler: IcerikOgesi[]; kesildi: boolean };
export function icerikIkili(kokler: Kokler, adres: string): { adres: string; boyut: number; base64: string };
export function icerikMetin(kokler: Kokler, adres: string): string;
/** Hata `kod`ları: gecersiz-ad | gecersiz-adres | var | yok | salt-okunur. */
export function yeniKlasor(kokler: Kokler, adres: string): string;
/** Hata `kod`ları: korumali | gecersiz-ad | var | yok | salt-okunur. Dönüş: yeni adres. */
export function adlandir(kokler: Kokler, adres: string, yeniAd: string): string;
export function cogalt(kokler: Kokler, adres: string): string;
/** Hata `kod`ları: korumali | gecersiz-adres | gecersiz-ad | var | yok | salt-okunur. Aynı tür klasörü içinde; dönüş: yeni adres. */
export function tasi(kokler: Kokler, adres: string, hedefKlasor: string): string;
export function icAdiUydur(tam: string, eskiGovde: string, yeniGovde: string): boolean;
/** Dönüş: `Content/.silinenler/…` altındaki yer (Content'e göre). */
export function sil(kokler: Kokler, adres: string, simdi?: () => number): string;
export function icAktarAdi(ad: string): string;
export function iceAktar(kokler: Kokler, hedefAdres: string, kaynaklar: readonly string[]): { eklenen: string[]; atlanan: { ad: string; neden: string }[] };
