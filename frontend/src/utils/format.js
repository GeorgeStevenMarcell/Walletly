const idrFmt = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function fmt(n) {
  return idrFmt.format(n);
}

export function fmtShort(n) {
  if (n >= 1_000_000_000) return "Rp " + (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "Rp " + (n / 1_000).toFixed(0) + "K";
  return fmt(n);
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function fmtDate(dateStr) {
  if (!dateStr) return "";
  // Handle ISO datetime strings by taking only the date portion
  const iso = String(dateStr).slice(0, 10);
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return String(dateStr);
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}
