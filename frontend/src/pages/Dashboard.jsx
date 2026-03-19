import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../context/WalletContext";
import { useNavigation } from "../context/NavigationContext";
import { api } from "../api";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "../constants";
import { fmt, fmtShort, fmtDate } from "../utils/format";
import { getPeriodKey, getCurrentPeriodKey, periodLabel, shiftPeriodKey, getPeriodSpend } from "../utils/period";
import SpendChart from "../components/SpendChart";

const GRAD = [["#f59e0b", "#f97316"], ["#10b981", "#06b6d4"], ["#3b82f6", "#6366f1"], ["#8b5cf6", "#ec4899"]];
const VIEW_MODE_KEY = "walletly_view_mode";

export default function Dashboard() {
  const { wallet, wallets, user, session, switchWallet, apiHelpers } = useWallet();
  const { setPage } = useNavigation();

  const userWallets = wallets || [];
  const hasMultiple = userWallets.length > 1;

  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    if (saved === "all" || saved === "single") return saved;
    // wallets haven't loaded yet on first render, default to "all" —
    // the effect below will correct to "single" once wallets arrive if only 1.
    return "all";
  });

  // Combined-mode state
  const [combinedTxns, setCombinedTxns] = useState([]);
  const [combinedCats, setCombinedCats] = useState([]);
  // Maps every category UUID (from any wallet) → merged category object
  const [combinedCatById, setCombinedCatById] = useState(new Map());
  const [combinedLoading, setCombinedLoading] = useState(false);

  // Persist viewMode
  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  // Only force single mode once wallets have actually loaded (length > 0).
  // Without the length guard this fires on mount when wallets=[] and
  // hasMultiple is false, destroying the saved "all" preference.
  useEffect(() => {
    if (userWallets.length > 0 && !hasMultiple && viewMode === "all") setViewMode("single");
  }, [userWallets.length, hasMultiple, viewMode]);

  // When wallets first load and user has multiple, honour saved "all" preference
  useEffect(() => {
    if (hasMultiple && localStorage.getItem(VIEW_MODE_KEY) === "all") setViewMode("all");
  }, [hasMultiple]);

  // Fetch combined data when in "all" mode
  const fetchCombined = useCallback(async () => {
    const included = userWallets.filter((w) => !w.exclude_combined);
    if (!included.length) {
      setCombinedTxns([]);
      setCombinedCats([]);
      setCombinedCatById(new Map());
      return;
    }
    setCombinedLoading(true);
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);
      const to = now.toISOString().slice(0, 10);
      const results = await Promise.all(
        included.map(async (w) => {
          const [txnRes, cats] = await Promise.all([
            api.getTransactions(w.id, { from, to }),
            api.getCategories(w.id),
          ]);
          const txnData = txnRes?.data ?? txnRes;
          return {
            walletId: w.id,
            walletName: w.name,
            transactions: (Array.isArray(txnData) ? txnData : []).map((t) => ({
              ...t,
              date: String(t.txn_date || t.date || "").slice(0, 10),
              category: t.category_id || t.category,
              amount: Number(t.amount),
              _walletId: w.id,
              _walletName: w.name,
            })),
            categories: Array.isArray(cats) ? cats : [],
          };
        })
      );
      const allTxns = results.flatMap((r) => r.transactions);
      // Merge categories by label + type, keeping first UUID as canonical
      const catByLabel = new Map();
      const idToMerged = new Map();
      for (const r of results) {
        for (const c of r.categories) {
          const key = `${c.label}||${c.type}`;
          if (!catByLabel.has(key)) catByLabel.set(key, { ...c });
          // Map this wallet's category UUID → the merged (canonical) category
          idToMerged.set(c.id, catByLabel.get(key));
        }
      }
      setCombinedTxns(allTxns);
      setCombinedCats([...catByLabel.values()]);
      setCombinedCatById(idToMerged);
    } catch (err) {
      console.error("[walletly] combined fetch error:", err);
    } finally {
      setCombinedLoading(false);
    }
  }, [userWallets]);

  useEffect(() => {
    if (viewMode === "all" && hasMultiple) fetchCombined();
  }, [viewMode, hasMultiple, fetchCombined]);

  // Determine which data to use based on view mode
  const isAll = viewMode === "all" && hasMultiple;

  // Single-wallet data (existing behavior)
  const msd = wallet?.settings?.monthStartDay || 1;
  const pk = getCurrentPeriodKey(msd);
  const singleCats = wallet?.expenseCategories || DEFAULT_EXPENSE_CATEGORIES;
  const singleAllC = [...singleCats, ...(wallet?.incomeCategories || DEFAULT_INCOME_CATEGORIES)];
  const singleTxns = wallet?.transactions || [];

  // All-wallet data
  const allExpCats = isAll ? combinedCats.filter((c) => c.type === "expense").map((c) => ({ id: c.id, label: c.label, icon: c.icon, color: c.color })) : [];
  const allIncCats = isAll ? combinedCats.filter((c) => c.type === "income").map((c) => ({ id: c.id, label: c.label, icon: c.icon, color: c.color })) : [];

  // Choose active data
  const activeTxns = isAll ? combinedTxns : singleTxns;
  const activeCats = isAll ? [...allExpCats, ...allIncCats] : singleAllC;
  const activeExpCats = isAll ? allExpCats : singleCats;

  // Resolve category from a transaction's category ID.
  // In combined mode, uses the ID→merged-category map so that category UUIDs
  // from any wallet resolve to the canonical merged category.
  const findCat = (catId) => {
    if (isAll) return combinedCatById.get(catId) || null;
    return activeCats.find((c) => c.id === catId) || null;
  };

  const periodTxns = activeTxns.filter((t) => getPeriodKey(t.date, msd) === pk);
  const inc = periodTxns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const exp = periodTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  // Balance: in "all" mode use sum of period_balance from included wallets, in single mode use computed
  const bal = isAll
    ? userWallets.filter((w) => !w.exclude_combined).reduce((s, w) => s + Number(w.period_balance ?? 0), 0)
    : inc - exp;

  const [balVis, setBalVis] = useState(true);
  const [reportTab, setReportTab] = useState("month");
  const [topTab, setTopTab] = useState("month");

  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);
  const prevWeekStart = new Date(weekStart); prevWeekStart.setDate(weekStart.getDate() - 7);
  const prevWeekEnd = new Date(weekStart); prevWeekEnd.setDate(weekStart.getDate() - 1); prevWeekEnd.setHours(23, 59, 59, 999);
  function inR(d, s, e) { const dt = new Date(d); return dt >= s && dt <= e; }

  const weekExp = activeTxns.filter((t) => t.type === "expense" && inR(t.date, weekStart, now)).reduce((s, t) => s + t.amount, 0);
  const prevWeekExp = activeTxns.filter((t) => t.type === "expense" && inR(t.date, prevWeekStart, prevWeekEnd)).reduce((s, t) => s + t.amount, 0);

  const topSrcTxns = topTab === "week"
    ? activeTxns.filter((t) => t.type === "expense" && inR(t.date, weekStart, now))
    : periodTxns.filter((t) => t.type === "expense");
  const topSrcTotal = topSrcTxns.reduce((s, t) => s + t.amount, 0) || 1;

  // For top spending, merge by category label in combined mode
  const catTotals = (() => {
    if (isAll) {
      const map = new Map();
      for (const t of topSrcTxns) {
        const cat = findCat(t.category);
        const key = cat?.label || "Other";
        if (!map.has(key)) map.set(key, { label: key, icon: cat?.icon || "\u{1F4E6}", color: cat?.color || "#6b7280", total: 0 });
        map.get(key).total += t.amount;
      }
      return [...map.values()].filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
    }
    return activeExpCats.map((c) => ({ ...c, total: topSrcTxns.filter((t) => t.category === c.id).reduce((s, t) => s + t.amount, 0) }))
      .filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  })();

  const avg3Months = (() => {
    const totals = [];
    for (let i = 1; i <= 3; i++) totals.push(getPeriodSpend(activeTxns, shiftPeriodKey(pk, i), msd));
    const nonZero = totals.filter((v) => v > 0);
    return nonZero.length > 0 ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
  })();

  const avg3Weeks = (() => {
    const weekTotals = [];
    for (let i = 1; i <= 12; i++) {
      const ws = new Date(weekStart); ws.setDate(ws.getDate() - 7 * i);
      const we = new Date(ws); we.setDate(ws.getDate() + 6); we.setHours(23, 59, 59, 999);
      const t = activeTxns.filter((x) => x.type === "expense" && inR(x.date, ws, we)).reduce((s, x) => s + x.amount, 0);
      if (t > 0) weekTotals.push(t);
    }
    return weekTotals.length > 0 ? weekTotals.reduce((a, b) => a + b, 0) / weekTotals.length : 0;
  })();

  const recentTxns = [...activeTxns].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  // Exclude toggle handler
  const handleToggleExclude = async (walletId, currentExclude) => {
    try {
      await api.toggleExcludeCombined(walletId, !currentExclude);
      // refreshWallets updates wallets state, which recreates fetchCombined via
      // the useCallback dep, which triggers the useEffect to re-fetch combined data.
      await apiHelpers.refreshWallets();
    } catch (err) {
      console.error("[walletly] toggle exclude error:", err);
    }
  };

  // Dropdown handler
  const handleWalletSelect = (value) => {
    if (value === "__all__") {
      setViewMode("all");
    } else {
      setViewMode("single");
      switchWallet(value);
    }
  };

  const includedCount = userWallets.filter((w) => !w.exclude_combined).length;

  return (
    <div style={{ background: "#0a0f1e", minHeight: "100%" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#475569", fontSize: 12 }}>Good day,</div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>{user?.name} {"\u{1F44B}"}</div>
        </div>
        {hasMultiple ? (
          <select style={{ background: "#131c2e", border: "1px solid #1e293b", color: "#94a3b8", borderRadius: 8, padding: "5px 8px", fontSize: 11, cursor: "pointer" }}
            value={isAll ? "__all__" : session?.walletId} onChange={(e) => handleWalletSelect(e.target.value)}>
            <option value="__all__">All Wallets</option>
            {userWallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        ) : userWallets.length === 1 ? null : null}
      </div>

      {/* Combined loading indicator */}
      {isAll && combinedLoading && (
        <div style={{ padding: "8px 20px 0", color: "#475569", fontSize: 11 }}>Loading combined data\u2026</div>
      )}

      {/* Balance Hero */}
      <div style={{ padding: "14px 16px 0" }}>
        <div style={{ background: "linear-gradient(135deg,#131c2e,#1a2540)", borderRadius: 20, padding: "20px", border: "1px solid #1e2d45", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "#22d3ee0a" }} />
          <div style={{ position: "absolute", bottom: -20, right: 30, width: 70, height: 70, borderRadius: "50%", background: "#6366f10a" }} />
          <div style={{ color: "#475569", fontSize: 11, marginBottom: 2 }}>
            {isAll ? "Combined balance" : "Total balance"} {"\u24D8"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", fontFamily: "monospace", letterSpacing: "-1px" }}>{balVis ? fmt(bal) : "Rp \u2022\u2022\u2022\u2022\u2022\u2022"}</div>
            <button onClick={() => setBalVis(!balVis)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#475569" }}>{balVis ? "\u{1F441}\uFE0F" : "\u{1F648}"}</button>
          </div>
          {isAll && includedCount === 0 ? (
            <div style={{ color: "#f59e0b", fontSize: 12 }}>All wallets are hidden</div>
          ) : (
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
          )}
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
            const wBal = !isAll && w.id === session?.walletId ? (inc - exp) : Number(w.period_balance ?? 0);
            const excluded = w.exclude_combined;
            return (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderBottom: i < userWallets.length - 1 ? "1px solid #1e293b" : "none", opacity: excluded ? 0.4 : 1 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg,${GRAD[i % 4][0]},${GRAD[i % 4][1]})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, cursor: "pointer" }}
                  onClick={() => { setViewMode("single"); switchWallet(w.id); }}>{"\u{1F4B3}"}</div>
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => { setViewMode("single"); switchWallet(w.id); }}>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{w.name}</div>
                  <div style={{ color: "#475569", fontSize: 11 }}>{(w.members || []).length} member{(w.members || []).length !== 1 ? "s" : ""}</div>
                </div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{balVis ? fmtShort(wBal) : "\u2022\u2022\u2022\u2022"}</div>
                {hasMultiple && (
                  <button onClick={(e) => { e.stopPropagation(); handleToggleExclude(w.id, excluded); }}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "2px 4px", color: excluded ? "#475569" : "#22d3ee", flexShrink: 0 }}
                    title={excluded ? "Include in combined view" : "Exclude from combined view"}>
                    {excluded ? "\u{1F441}\u200D\u{1F5E8}" : "\u{1F441}\uFE0F"}
                  </button>
                )}
                {!hasMultiple && w.id === session?.walletId && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22d3ee", flexShrink: 0 }} />}
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
              {!isAll && <SpendChart wallet={wallet} mode="week" weekStart={weekStart} prevWeekStart={prevWeekStart} prevWeekEnd={prevWeekEnd} now={now} avg3={avg3Weeks} />}
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
              {!isAll && <SpendChart wallet={wallet} mode="month" pk={pk} msd={msd} avg3={avg3Months} />}
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
              <div key={c.id || c.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderBottom: i < Math.min(catTotals.length, 4) - 1 ? "1px solid #1e293b" : "none" }}>
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
            const cat = findCat(t.category);
            // Find wallet color index for badge
            const wIdx = userWallets.findIndex((w) => w.id === (t._walletId || t.wallet_id));
            return (
              <div key={t.id} onClick={() => setPage("transactions")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderBottom: i < recentTxns.length - 1 ? "1px solid #1e293b" : "none", cursor: "pointer" }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: (cat?.color || "#6b7280") + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>{cat?.icon || "\u{1F4B1}"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{cat?.label || "Transaction"}</span>
                    {isAll && t._walletName && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8,
                        background: `linear-gradient(135deg,${GRAD[wIdx >= 0 ? wIdx % 4 : 0][0]}33,${GRAD[wIdx >= 0 ? wIdx % 4 : 0][1]}33)`,
                        color: GRAD[wIdx >= 0 ? wIdx % 4 : 0][0],
                      }}>{t._walletName}</span>
                    )}
                  </div>
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
