import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { useToast } from "../hooks/useToast";
import { DEFAULT_EXPENSE_CATEGORIES } from "../constants";
import { getCurrentPeriodKey, getPeriodKey, getPeriodDates } from "../utils/period";
import { fmt, fmtShort } from "../utils/format";
import { D } from "../styles/tokens";
import ConfirmDialog from "../components/ConfirmDialog";
import BudgetDetail from "./BudgetDetail";

export default function BudgetPage() {
  const { wallet, wallets, session, switchWallet, apiHelpers } = useWallet();
  const { showToast } = useToast();

  const msd = wallet.settings?.monthStartDay || 1;
  const pk = getCurrentPeriodKey(msd);
  const cats = wallet.expenseCategories || DEFAULT_EXPENSE_CATEGORIES;
  const txns = wallet.transactions.filter((t) => getPeriodKey(t.date, msd) === pk && t.type === "expense");

  const [detail, setDetail] = useState(null);
  const [adding, setAdding] = useState(false);
  const [nb, setNb] = useState({ catId: cats[0]?.id || "", amount: "" });
  const [editId, setEditId] = useState(null);
  const [editAmt, setEditAmt] = useState("");
  const [confirmBudget, setConfirmBudget] = useState(null);

  const today = new Date();
  const { start: pStart, end: pEnd } = getPeriodDates(pk, msd);
  const totalDays = Math.round((pEnd - pStart) / 864e5) + 1;
  const daysPassed = Math.max(1, Math.min(totalDays, Math.round((today - pStart) / 864e5) + 1));
  const daysLeft = Math.max(0, totalDays - daysPassed);
  const startStr = pStart.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" });
  const endStr = pEnd.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" });

  async function saveBudget(catId, amt) {
    try {
      await apiHelpers.upsertBudget(catId, +amt);
      setEditId(null);
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function delBudget(catId) {
    const budgetId = wallet._budgetRows?.find((b) => b.category_id === catId)?.id;
    try {
      await apiHelpers.deleteBudget(budgetId || catId);
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function addBudget() {
    if (!nb.catId || !nb.amount || +nb.amount <= 0) return showToast("Pick category & amount", "error");
    try {
      await apiHelpers.upsertBudget(nb.catId, +nb.amount);
      setNb({ catId: cats[0]?.id || "", amount: "" });
      setAdding(false);
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  const detailCat = detail ? cats.find((c) => c.id === detail) : null;
  if (detailCat)
    return (
      <BudgetDetail
        cat={detailCat}
        txns={txns}
        pStart={pStart}
        pEnd={pEnd}
        totalDays={totalDays}
        daysPassed={daysPassed}
        daysLeft={daysLeft}
        startStr={startStr}
        endStr={endStr}
        onBack={() => setDetail(null)}
      />
    );

  const budgeted = cats.filter((c) => (wallet.budgets || {})[c.id] > 0);
  const unbudgeted = cats.filter((c) => !((wallet.budgets || {})[c.id] > 0));
  const totSpent = txns.reduce((s, t) => s + t.amount, 0);
  const totBudget = Object.values(wallet.budgets || {}).reduce((s, v) => s + (v || 0), 0);
  const totPct = totBudget > 0 ? Math.min((totSpent / totBudget) * 100, 100) : 0;
  const totOver = totBudget > 0 && totSpent > totBudget;
  const actDaily = daysPassed > 0 ? totSpent / daysPassed : 0;
  const recDaily = daysLeft > 0 ? (totBudget - totSpent) / daysLeft : 0;
  const projected = actDaily * totalDays;

  return (
    <div style={{ background: "#0a0f1e", minHeight: "100%", padding: "16px 16px 120px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>Budgets</div>
          <div style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>
            {startStr} \u2013 {endStr} · {daysLeft} days left
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {wallets.length > 1 && (
            <select style={{ background: "#131c2e", border: "1px solid #1e293b", color: "#94a3b8", borderRadius: 8, padding: "5px 8px", fontSize: 11, cursor: "pointer" }}
              value={session?.walletId} onChange={(e) => switchWallet(e.target.value)}>
              {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}
          <button style={{ ...D.btn, padding: "7px 12px", fontSize: 12 }} onClick={() => setAdding(!adding)}>
            {adding ? "\u2715" : "+ Add"}
          </button>
        </div>
      </div>

      {adding && (
        <div style={{ background: "#131c2e", borderRadius: 14, padding: 14, marginBottom: 12, border: "1px solid #1e293b" }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Set Budget</div>
          <select style={D.inp} value={nb.catId} onChange={(e) => setNb({ ...nb, catId: e.target.value })}>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
          <input
            style={D.inp}
            type="number"
            placeholder="Amount (IDR)"
            value={nb.amount}
            onChange={(e) => setNb({ ...nb, amount: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && addBudget()}
          />
          <button style={{ ...D.btn, width: "100%", padding: 11 }} onClick={addBudget}>
            Save Budget
          </button>
        </div>
      )}

      {totBudget > 0 && (
        <div style={{ background: "#131c2e", borderRadius: 14, padding: 14, marginBottom: 12, border: "1px solid #1e293b" }}>
          <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 2 }}>{"\uD83C\uDF10"} All Categories</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", fontFamily: "monospace", marginBottom: 8 }}>{fmt(totBudget)}</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
            <span style={{ color: "#94a3b8" }}>
              Spent <span style={{ color: "#fff", fontWeight: 600 }}>{fmt(totSpent)}</span>
            </span>
            <span style={{ color: totOver ? "#f87171" : "#10b981", fontWeight: 600 }}>
              {totOver ? `Over ${fmt(totSpent - totBudget)}` : `${fmt(totBudget - totSpent)} left`}
            </span>
          </div>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <div style={{ background: "#1e293b", borderRadius: 99, height: 7 }}>
              <div
                style={{
                  width: `${totPct}%`,
                  height: "100%",
                  borderRadius: 99,
                  background: totOver ? "#ef4444" : totPct > 75 ? "#f59e0b" : "#22d3ee",
                }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                top: -1,
                left: `${Math.min((daysPassed / totalDays) * 100, 97)}%`,
                transform: "translateX(-50%)",
              }}
            >
              <div style={{ width: 2, height: 9, background: "#fff", borderRadius: 2 }} />
              <div style={{ fontSize: 8, color: "#94a3b8", whiteSpace: "nowrap", marginTop: 1 }}>Today</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {[
              ["\uD83D\uDCA1 Rec. daily", fmt(Math.max(0, recDaily))],
              ["\uD83D\uDCCA Projected", fmt(projected)],
              ["\u26A1 Actual/day", fmt(actDaily)],
              [`\uD83D\uDCC5 ${daysLeft} days left`, "of " + totalDays],
            ].map(([l, v]) => (
              <div key={l} style={{ background: "#0a0f1e", borderRadius: 9, padding: "7px 9px" }}>
                <div style={{ color: "#475569", fontSize: 9, marginBottom: 1 }}>{l}</div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {budgeted.length > 0 && (
        <>
          <div style={{ color: "#334155", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>Active Budgets</div>
          {budgeted.map((c) => {
            const spent = txns.filter((t) => t.category === c.id).reduce((s, t) => s + t.amount, 0);
            const budget = (wallet.budgets || {})[c.id] || 0;
            const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
            const over = budget > 0 && spent > budget;
            const isEdit = editId === c.id;
            return (
              <div
                key={c.id}
                style={{
                  background: "#131c2e",
                  borderRadius: 13,
                  padding: 13,
                  marginBottom: 8,
                  border: `1px solid ${c.color}33`,
                  cursor: "pointer",
                }}
                onClick={() => !isEdit && setDetail(c.id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 9,
                        background: c.color + "22",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        flexShrink: 0,
                      }}
                    >
                      {c.icon}
                    </div>
                    <div>
                      <div style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{c.label}</div>
                      {over && <div style={{ color: "#f87171", fontSize: 10, fontWeight: 700 }}>{"\u26A0"} Over budget</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 5 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setEditId(c.id);
                        setEditAmt(String(budget));
                      }}
                      style={{ background: "#1e293b", border: "none", borderRadius: 7, padding: "3px 9px", cursor: "pointer", fontSize: 11, color: "#94a3b8" }}
                    >
                      {"\u270F\uFE0F"}
                    </button>
                    <button
                      onClick={() => setConfirmBudget(c.id)}
                      style={{ background: "#ef444420", border: "none", borderRadius: 7, padding: "3px 9px", cursor: "pointer", fontSize: 11, color: "#f87171" }}
                    >
                      {"\uD83D\uDDD1\uFE0F"}
                    </button>
                  </div>
                </div>
                {isEdit ? (
                  <div style={{ display: "flex", gap: 7 }} onClick={(e) => e.stopPropagation()}>
                    <input
                      autoFocus
                      style={{ ...D.inp, margin: 0, flex: 1 }}
                      type="number"
                      value={editAmt}
                      onChange={(e) => setEditAmt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveBudget(c.id, editAmt);
                        if (e.key === "Escape") setEditId(null);
                      }}
                    />
                    <button style={{ ...D.btn, padding: "8px 12px", fontSize: 12 }} onClick={() => saveBudget(c.id, editAmt)}>
                      Save
                    </button>
                    <button
                      style={{ background: "#1e293b", border: "none", borderRadius: 9, padding: "8px 10px", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}
                      onClick={() => setEditId(null)}
                    >
                      {"\u2715"}
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 5 }}>
                      <span>
                        Spent <span style={{ color: "#fff", fontWeight: 600 }}>{fmt(spent)}</span>
                      </span>
                      <span>
                        of <span style={{ color: "#fff", fontWeight: 600 }}>{fmt(budget)}</span>
                      </span>
                    </div>
                    <div style={{ background: "#1e293b", borderRadius: 99, height: 5 }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          borderRadius: 99,
                          background: over ? "#ef4444" : pct > 75 ? "#f59e0b" : c.color,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 10, color: "#1e293b", marginTop: 5 }}>Tap for details {"\u2192"}</div>
                  </>
                )}
              </div>
            );
          })}
        </>
      )}

      {unbudgeted.length > 0 && (
        <>
          <div style={{ color: "#334155", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 7, marginTop: 10 }}>No Budget Set</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
            {unbudgeted.map((c) => {
              const spent = txns.filter((t) => t.category === c.id).reduce((s, t) => s + t.amount, 0);
              return (
                <div key={c.id} style={{ background: "#131c2e", borderRadius: 11, padding: "11px", border: "1px solid #1e293b" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontSize: 19 }}>{c.icon}</div>
                    <button
                      onClick={() => {
                        setNb({ catId: c.id, amount: "" });
                        setAdding(true);
                      }}
                      style={{
                        background: "#10b98120",
                        border: "none",
                        borderRadius: 7,
                        padding: "2px 7px",
                        cursor: "pointer",
                        fontSize: 10,
                        fontWeight: 600,
                        color: "#10b981",
                      }}
                    >
                      + Set
                    </button>
                  </div>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 12, marginTop: 5 }}>{c.label}</div>
                  {spent > 0 && <div style={{ color: "#475569", fontSize: 10, marginTop: 1 }}>{fmtShort(spent)}</div>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {confirmBudget && (
        <ConfirmDialog
          title="Remove Budget"
          message="The budget limit for this category will be cleared."
          confirmLabel="Remove"
          onConfirm={() => {
            delBudget(confirmBudget);
            setConfirmBudget(null);
          }}
          onCancel={() => setConfirmBudget(null)}
        />
      )}
    </div>
  );
}
