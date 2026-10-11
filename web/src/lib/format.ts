const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹ with Indian digit grouping: 1,80,000 */
export const inr = (n: number | null | undefined) => (n == null ? "—" : `${n < 0 ? "−" : ""}₹${inrFmt.format(Math.abs(Math.round(n)))}`);

/** Compact range: ₹44,000 – ₹52,000 */
export const inrRange = (lo: number | null, hi: number | null) => (lo == null || hi == null ? "—" : lo === hi ? inr(lo) : `${inr(lo)} – ${inr(hi)}`);

export const shortInr = (n: number) =>
  Math.abs(n) >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : Math.abs(n) >= 1e5 ? `₹${(n / 1e5).toFixed(2).replace(/\.00$/, "")} L` : inr(n);

export const dateFmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export const asOf = (iso: string) => `as of ${dateFmt(iso)}`;

export const daysFrom = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5);

export const bytes = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export const SEGMENT_LABEL: Record<string, string> = {
  commute: "Commute", touring: "Touring", adventure: "Adventure", performance: "Performance", ev: "Electric",
};
export const SEGMENT_COLOR: Record<string, string> = {
  commute: "#18A999", touring: "#4DA3FF", adventure: "#FFC845", performance: "#F0505A", ev: "#7C5CFF",
};
export const TYPE_LABEL = { car: "Car", bike: "Bike", scooter: "Scooter" } as const;
