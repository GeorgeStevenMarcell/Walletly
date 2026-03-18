import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { useNavigation } from "../context/NavigationContext";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "../constants";
import { fmt, fmtShort, fmtDate } from "../utils/format";
import { getPeriodKey, getCurrentPeriodKey, periodLabel, shiftPeriodKey, getPeriodSpend } from "../utils/period";
import SpendChart from "../components/SpendChart";

export default function Dashboard() {
  const { wallet, wallets, user, session, switchWallet } = useWallet();
  const { setPage } = useNavigation();

  const msd = wallet.settings?.monthStartDay || 1;
  const pk = getCurrentPeriodKey(msd);
  const cats = wallet.expenseCategories || DEFAULT_EXPENSE_CATEGORIES;
  const allC = [...cats, ...(wallet.incomeCategories || DEFAULT_INCOME_CATEGORIES)];
  const txns = wallet.transactions.filter((t) => getPeriodKey(t.date, msd) === pk);
  const inc = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const exp = txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const bal = inc - exp;
  const [balVis, setBalVis] = useState(true);
  const [reportTab, setReportTab] = useState("month");
  const [topTab, setTopTab] = useState("month");

  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);
  const prevWeekStart = new Date(weekStart); prevWeekStart.setDate(weekStart.getDate() - 7);
  const prevWeekEnd = new Date(weekStart); prevWeekEnd.setDate(weekStart.getDate() - 1); prevWeekEnd.setHours(23, 59, 59, 999);
  function inR(d, s, e) { const dt = new Date(d); return dt >= s && dt <= e; }

  const weekExp = wallet.transactions.filter((t) => t.type === "expense" && inR(t.date, weekStart, now)).reduce((s, t) => s + t.amount, 0);
  const prevWeekExp = wallet.transactions.filter((t) => t.type === "expense" && inR(t.date, prevWeekStart, prevWeekEnd)).reduce((s, t) => s + t.amount, 0);

  const topSrcTxns = topTab === "week"
    ? wallet.transactions.filter((t) => t.type === "expense" && inR(t.date, weekStart, now))
    : txns.filter((t) => t.type === "expense");
  const topSrcTotal = topSrcTxns.reduce((s, t) => s + t.amount, 0) || 1;
  const catTotals = cats.map((c) => ({ ...c, total: topSrcTxns.filter((t) => t.category === c.id).reduce((s, t) => s + t.amount, 0) }))
    .filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

  const avg3Months = (() => {
    const totals = [];
    for (let i = 1; i <= 3; i++) totals.push(getPeriodSpend(wallet.transactions, shiftPeriodKey(pk, i), msd));
    const nonZero = totals.filter((v) => v > 0);
    return nonZero.length > 0 ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
  })();

  const avg3Weeks = (() => {
    const weekTotals = [];
    for (let i = 1; i <= 12; i++) {
      const ws = new Date(weekStart); ws.setDate(ws.getDate() - 7 * i);
      const we = new Date(ws); we.setDate(ws.getDate() + 6); we.setHours(23, 59, 59, 999);
      const t = wallet.transactions.filter((x) => x.type === "expense" && inR(x.date, ws, we)).reduce((s, x) => s + x.amount, 0);
      if (t > 0) weekTotals.push(t);
    }
    return weekTotals.length > 0 ? weekTotals.reduce((a, b) => a + b, 0) / weekTotals.length : 0;
  })();

  const userWallets = wallets || [];
  const recentTxns = [...wallet.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <div style={{ background: "#0a0f1e", minHeight: "100%" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#475569", fontSize: 12 }}>Good day,</div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>{user?.name} {"\u{1F44B}"}</div>
        </div>
        {userWallets.length > 1 && (
          <select style={{ background: "#131c2e", border: "1px solid #1e293b", color: "#94a3b8", borderRadius: 8, padding: "5px 8px", fontSize: 11, cursor: "pointer" }}
            value={session?.walletId} onChange={(e) => switchWallet(e.target.value)}>
            {userWallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
      </div>

      {/* Balance Hero */}
      <div style={{ padding: "14px 16px 0" }}>
        <div style={{ background: "linear-gradient(135deg,#131c2e,#1a2540)", borderRadius: 20, padding: "20px", border: "1px solid #1e2d45", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "#22d3ee0a" }} />
          <div style={{ position: "absolute", bottom: -20, right: 30, width: 70, height: 70, borderRadius: "50%", background: "#6366f10a" }} />
          <div style={{ color: "#475569", fontSize: 11, marginBottom: 2 }}>Total balance {"\u24D8"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", fontFamily: "monospace", letterSpacing: "-1px" }}>{balVis ? fmt(bal) : "Rp \u2022\u2022\u2022\u2022\u2022\u2022"}</div>
            <button onClick={() => setBalVis(!balVis)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#475569" }}>{balVis ? "\u{1F441}\uFE0F" : "\u{1F648}"}</button>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, background: "#ffffff07", borderRadius: 10, padding: "8px 10px" }}>
              <div style={{ color: "#10b981", fontSize: 10, marginBottom: 1 }}>{"\u2191"} Income</div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{balVis ? fmtShort(inc) : "\u2022\u2022\u2022\u2022"}</div>
            </div>
            <div style={{ flex: 1, background: "#ffffff07", borderRadius: 10, padding: "8px 10px" }}>
              <div style={{ color: "#f87171", fontSize: 10, marginBottom: 1 }}>{"\u2193"} Expenses</div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{balVis ? fmtShort(exp) : "\u2022\u2022\u2022\u2022"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* My Wallets */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>My Wallets</div>
          <button onClick={() => setPage("settings")} style={{ background: "none", border: "none", color: "#22d3ee", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>See all</button>
        </div>
        <div style={{ background: "#131c2e", borderRadius: 14, overflow: "hidden", border: "1px solid #1e293b" }}>
          {userWallets.map((w, i) => {
            const wBal = w.id === session?.walletId ? bal : Number(w.period_balance ?? 0);
            const GRAD = [["#f59e0b", "#f97316"], ["#10b981", "#06b6d4"], ["#3b82f6", "#6366f1"], ["#8b5cf6", "#ec4899"]];
            return (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderBottom: i < userWallets.length - 1 ? "1px solid #1e293b" : "none", cursor: "pointer" }} onClick={() => switchWallet(w.id)}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg,${GRAD[i % 4][0]},${GRAD[i % 4][1]})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{"\u{1F4B3}"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{w.name}</div>
                  <div style={{ color: "#475569", fontSize: 11 }}>{(w.members || []).length} member{(w.members || []).length !== 1 ? "s" : ""}</div>
                </div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{balVis ? fmtShort(wBal) : "\u2022\u2022\u2022\u2022"}</div>
                {w.id === session?.walletId && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22d3ee", flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Spending Report */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>Report this month</div>
          <button onClick={() => setPage("recap")} style={{ background: "none", border: "none", color: "#22d3ee", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>See reports</button>
        </div>
        <div style={{ background: "#131c2e", borderRadius: 14, padding: "14px", border: "1px solid #1e293b" }}>
          <div style={{ display: "flex", background: "#0a0f1e", borderRadius: 9, padding: 3, marginBottom: 12 }}>
            {["week", "month"].map((t) => (
              <button key={t} onClick={() => setReportTab(t)} style={{ flex: 1, padding: "7px 0", border: "none", background: reportTab === t ? "#1e293b" : "transparent", cursor: "pointer", borderRadius: 7, fontWeight: 600, color: reportTab === t ? "#fff" : "#475569", fontSize: 12 }}>
                {t === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>
          {reportTab === "week" ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div>
                  <div style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>{fmtShort(weekExp)}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, marginTop: 2 }}>
                    <span style={{ color: weekExp <= prevWeekExp ? "#10b981" : "#f87171" }}>{weekExp <= prevWeekExp ? "\u2193" : "\u2191"} {prevWeekExp > 0 ? Math.abs(Math.round((weekExp - prevWeekExp) / prevWeekExp * 100)) + "% vs last week" : "First week"}</span>
                  </div>
                </div>
                {avg3Weeks > 0 && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700 }}>3-mo avg</div>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>{fmtShort(avg3Weeks)}/wk</div>
                    <div style={{ color: weekExp <= avg3Weeks ? "#10b981" : "#f87171", fontSize: 10, marginTop: 1 }}>{weekExp <= avg3Weeks ? "\u2193 below avg" : "\u2191 above avg"}</div>
                  </div>
                )}
              </div>
              <SpendChart wallet={wallet} mode="week" weekStart={weekStart} prevWeekStart={prevWeekStart} prevWeekEnd={prevWeekEnd} now={now} avg3={avg3Weeks} />
              {avg3Weeks > 0 && (
                <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#64748b" }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#f87171" }} />This week</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#64748b" }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#f8717133" }} />Last week</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#64748b" }}><div style={{ width: 14, height: 2, background: "#f59e0b", borderRadius: 1, marginRight: 1 }} />3-mo avg</div>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div>
                  <div style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>{fmtShort(exp)}</div>
                  <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>Total spent {"\u00B7"} {periodLabel(pk, msd)}</div>
                </div>
                {avg3Months > 0 && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700 }}>3-mo avg</div>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>{fmtShort(avg3Months)}/mo</div>
                    <div style={{ color: exp <= avg3Months ? "#10b981" : "#f87171", fontSize: 10, marginTop: 1 }}>{exp <= avg3Months ? "\u2193 below avg" : "\u2191 above avg"}</div>
                  </div>
                )}
              </div>
              <SpendChart wallet={wallet} mode="month" pk={pk} msd={msd} avg3={avg3Months} />
              {avg3Months > 0 && (
                <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#64748b" }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#22d3ee" }} />This month</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#64748b" }}><div style={{ width: 14, height: 2, background: "#f59e0b", borderRadius: 1, marginRight: 1 }} />3-mo avg</div>
                  {avg3Months > 0 && exp > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: exp <= avg3Months ? "#10b981" : "#f87171", marginLeft: "auto" }}>
                      {exp <= avg3Months ? "\u2193" : "\u2191"} {Math.abs(Math.round((exp - avg3Months) / avg3Months * 100))}% vs avg
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          <button style={{ background: "none", border: "none", color: "#22d3ee", fontSize: 12, cursor: "pointer", fontWeight: 600, marginTop: 10, padding: 0 }} onClick={() => setPage("recap")}>Spending report {"\u2192"}</button>
        </div>
      </div>

      {/* Top Spending */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Top spending</div>
          <button onClick={() => setPage("budget")} style={{ background: "none", border: "none", color: "#22d3ee", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>See details</button>
        </div>
        <div style={{ display: "flex", background: "#131c2e", borderRadius: 10, padding: 3, marginBottom: 10, border: "1px solid #1e293b" }}>
          {["week", "month"].map((t) => (
            <button key={t} onClick={() => setTopTab(t)} style={{ flex: 1, padding: "7px 0", border: "none", background: topTab === t ? "#1e293b" : "transparent", cursor: "pointer", borderRadius: 8, fontWeight: 600, color: topTab === t ? "#fff" : "#475569", fontSize: 12 }}>
              {t === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
        <div style={{ background: "#131c2e", borderRadius: 14, overflow: "hidden", border: "1px solid #1e293b" }}>
          {catTotals.length === 0 ? (
            <div style={{ padding: 20, color: "#475569", textAlign: "center", fontSize: 13 }}>No expenses yet</div>
          ) : catTotals.slice(0, 4).map((c, i) => {
            const pct = Math.round(c.total / topSrcTotal * 100);
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderBottom: i < Math.min(catTotals.length, 4) - 1 ? "1px solid #1e293b" : "none" }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: c.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{c.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{c.label}</div>
                  <div style={{ color: "#475569", fontSize: 11, marginTop: 1 }}>{fmt(c.total)}</div>
                </div>
                <div style={{ color: pct > 50 ? "#f87171" : pct > 25 ? "#f59e0b" : "#94a3b8", fontWeight: 700, fontSize: 13 }}>{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Transactions */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Recent transactions</div>
          <button onClick={() => setPage("transactions")} style={{ background: "none", border: "none", color: "#22d3ee", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>See all</button>
        </div>
        <div style={{ background: "#131c2e", borderRadius: 14, overflow: "hidden", border: "1px solid #1e293b", marginBottom: 110 }}>
          {recentTxns.length === 0 ? (
            <div style={{ padding: 20, color: "#475569", textAlign: "center", fontSize: 13 }}>No transactions yet</div>
          ) : recentTxns.map((t, i) => {
            const cat = allC.find((c) => c.id === t.category);
            return (
              <div key={t.id} onClick={() => setPage("transactions")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderBottom: i < recentTxns.length - 1 ? "1px solid #1e293b" : "none", cursor: "pointer" }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: (cat?.color || "#6b7280") + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>{cat?.icon || "\u{1F4B1}"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{cat?.label || "Transaction"}</div>
                  <div style={{ color: "#475569", fontSize: 11, marginTop: 1 }}>{fmtDate(t.date)}{t.note ? " \u00B7 " + t.note : ""}</div>
                </div>
                <div style={{ color: t.type === "income" ? "#10b981" : "#f87171", fontWeight: 700, fontSize: 13 }}>
                  {t.type === "income" ? "+" : "-"}{fmtShort(t.amount)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
