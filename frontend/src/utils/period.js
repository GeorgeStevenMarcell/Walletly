import { MONTHS } from "../constants";

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function getPeriodKey(dateStr, msd) {
  if (msd === 1) return dateStr.slice(0, 7);
  const d = new Date(dateStr);
  const day = d.getDate();
  let year = d.getFullYear();
  let month = d.getMonth();
  if (day < msd) {
    month--;
    if (month < 0) { month = 11; year--; }
  }
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function getCurrentPeriodKey(msd) {
  return getPeriodKey(todayStr(), msd);
}

export function periodLabel(key, msd) {
  if (!key) return "\u2014";
  const [y, m] = key.split("-");
  const mn = MONTHS[parseInt(m) - 1];
  if (msd === 1) return `${mn} ${y}`;
  const em = parseInt(m) === 12 ? 1 : parseInt(m) + 1;
  const ey = parseInt(m) === 12 ? parseInt(y) + 1 : parseInt(y);
  return `${mn} ${y} \u2013 ${MONTHS[em - 1]} ${ey}`;
}

export function getPeriodDates(pk, msd) {
  const [y, m] = pk.split("-").map(Number);
  const start = new Date(y, m - 1, msd);
  const em = m === 12 ? 1 : m + 1;
  const ey = m === 12 ? y + 1 : y;
  const end = new Date(ey, em - 1, msd - 1);
  return { start, end };
}

export function shiftPeriodKey(pk, monthsBack) {
  let [y, m] = pk.split("-").map(Number);
  m -= monthsBack;
  while (m < 1) { m += 12; y--; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function getPeriodSpend(transactions, pk, msd) {
  return transactions
    .filter((t) => t.type === "expense" && getPeriodKey(t.date, msd) === pk)
    .reduce((s, t) => s + t.amount, 0);
}
