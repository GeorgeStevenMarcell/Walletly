import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { DEFAULT_EXPENSE_CATEGORIES } from "../constants";
import { getCurrentPeriodKey, getPeriodKey, periodLabel } from "../utils/period";
import { fmt, fmtShort } from "../utils/format";

export default function MonthlyRecap() {
  const { wallet } = useWallet();

  const msd = wallet.settings?.monthStartDay || 1;
  const cats = wallet.expenseCategories || DEFAULT_EXPENSE_CATEGORIES;
  const periods = [...new Set(wallet.transactions.map((t) => getPeriodKey(t.date, msd)))].sort().reverse();
  const [sel, setSel] = useState(periods[0] || getCurrentPeriodKey(msd));

  const txns = wallet.transactions.filter((t) => getPeriodKey(t.date, msd) === sel);
  const income = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  const catBreak = cats
    .map((c) => ({
      ...c,
      total: txns.filter((t) => t.type === "expense" && t.category === c.id).reduce((s, t) => s + t.amount, 0),
      budget: (wallet.budgets || {})[c.id] || 0,
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const catBreakFull = catBreak.map((c) => ({ ...c, over: c.budget > 0 && c.total > c.budget }));
  const topCat = catBreakFull[0];
  const overCats = catBreakFull.filter((c) => c.over);
  const savRate = income > 0 ? ((income - expense) / income * 100).toFixed(1) : 0;

  return (
    <div style={{ background: "#0a0f1e", minHeight: "100%", padding: "16px 16px 120px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>Monthly Recap</div>
        <select
          style={{
            background: "#131c2e",
            border: "1px solid #1e293b",
            color: "#94a3b8",
            borderRadius: 9,
            padding: "6px 10px",
            fontSize: 11,
            cursor: "pointer",
          }}
          value={sel}
          onChange={(e) => setSel(e.target.value)}
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {periodLabel(p, msd)}
            </option>
          ))}
        </select>
      </div>

      {txns.length === 0 ? (
        <div style={{ color: "#475569", textAlign: "center", padding: 40, fontSize: 13 }}>No data for this period</div>
      ) : (
        <>
          <div
            style={{
              background: "linear-gradient(135deg,#131c2e,#1a2540)",
              borderRadius: 14,
              padding: 14,
              marginBottom: 12,
              border: "1px solid #1e293b",
            }}
          >
            <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 10 }}>{periodLabel(sel, msd)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                ["\u2191 Income", fmt(income), "#10b981"],
                ["\u2193 Expenses", fmt(expense), "#f87171"],
                ["\uD83D\uDCB0 Balance", fmt(balance), balance >= 0 ? "#22d3ee" : "#f59e0b"],
                ["\uD83D\uDCC8 Saved", savRate + "%", "#8b5cf6"],
              ].map(([l, v, c]) => (
                <div key={l} style={{ background: "#ffffff07", borderRadius: 10, padding: "9px 10px" }}>
                  <div style={{ color: "#475569", fontSize: 10, marginBottom: 3 }}>{l}</div>
                  <div style={{ color: c, fontWeight: 800, fontSize: 15 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 12 }}>
            {[
              topCat ? [topCat.icon, "Top Category", topCat.label, topCat.color] : ["\uD83D\uDCCA", "Top Category", "None", "#475569"],
              [
                overCats.length > 0 ? "\u26A0\uFE0F" : "\u2705",
                "Budget",
                overCats.length > 0 ? `${overCats.length} over` : "On track",
                overCats.length > 0 ? "#f87171" : "#10b981",
              ],
              ["\uD83D\uDCCB", "Transactions", String(txns.length), "#8b5cf6"],
            ].map(([ico, lbl, val, col]) => (
              <div key={lbl} style={{ background: "#131c2e", borderRadius: 12, padding: "11px 10px", border: "1px solid #1e293b" }}>
                <div style={{ fontSize: 20, marginBottom: 5 }}>{ico}</div>
                <div style={{ color: "#475569", fontSize: 9, marginBottom: 2 }}>{lbl}</div>
                <div style={{ color: col, fontWeight: 800, fontSize: 12 }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "#131c2e", borderRadius: 14, padding: 14, border: "1px solid #1e293b" }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 12, marginBottom: 12 }}>Spending by Category</div>
            {catBreakFull.length === 0 ? (
              <div style={{ color: "#475569", textAlign: "center", padding: 16, fontSize: 12 }}>No expenses</div>
            ) : (
              catBreakFull.map((c, i) => {
                const maxS = catBreakFull[0]?.total || 1;
                return (
                  <div key={c.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 16 }}>{c.icon}</span>
                        <span style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>{c.label}</span>
                        {c.over && (
                          <span style={{ background: "#f8717120", color: "#f87171", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 99 }}>
                            OVER
                          </span>
                        )}
                        {i === 0 && (
                          <span style={{ background: "#f59e0b20", color: "#f59e0b", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 99 }}>
                            TOP
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>{fmtShort(c.total)}</div>
                        {c.budget > 0 && <div style={{ color: "#475569", fontSize: 10 }}>/ {fmtShort(c.budget)}</div>}
                      </div>
                    </div>
                    <div style={{ background: "#1e293b", borderRadius: 99, height: 4 }}>
                      <div
                        style={{
                          width: `${(c.total / maxS) * 100}%`,
                          height: "100%",
                          borderRadius: 99,
                          background: c.over ? "#ef4444" : c.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
