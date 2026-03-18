import { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
import { useToast } from "../hooks/useToast";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "../constants";
import { getCurrentPeriodKey, getPeriodKey, periodLabel } from "../utils/period";
import { fmt, fmtDate } from "../utils/format";
import { D } from "../styles/tokens";
import ConfirmDialog from "../components/ConfirmDialog";

export default function Transactions() {
  const { wallet, apiHelpers } = useWallet();
  const { showToast } = useToast();

  const msd = wallet.settings?.monthStartDay || 1;
  const cats = wallet.expenseCategories || DEFAULT_EXPENSE_CATEGORIES;
  const incomeCats = wallet.incomeCategories || DEFAULT_INCOME_CATEGORIES;
  const allCats = [...cats, ...incomeCats];

  const [tab, setTab] = useState("all");
  const [filter, setFilter] = useState(getCurrentPeriodKey(msd));
  const [confirmId, setConfirmId] = useState(null);
  const [detailTxn, setDetailTxn] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [busy, setBusy] = useState(false);

  // Reset filter and close modal when wallet changes
  useEffect(() => {
    setFilter(getCurrentPeriodKey(msd));
    setDetailTxn(null);
    setEditing(false);
  }, [wallet.id]);

  const periods = [...new Set(wallet.transactions.map((t) => getPeriodKey(t.date, msd)))].sort().reverse();
  if (!periods.includes(getCurrentPeriodKey(msd))) periods.unshift(getCurrentPeriodKey(msd));

  const txns = wallet.transactions
    .filter((t) => getPeriodKey(t.date, msd) === filter)
    .filter((t) => tab === "all" || t.type === tab)
    .sort((a, b) => b.date.localeCompare(a.date));

  async function del(id) {
    try {
      await apiHelpers.deleteTransaction(id);
      setConfirmId(null);
      setDetailTxn(null);
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  function openDetail(t) {
    setDetailTxn(t);
    setEditing(false);
  }

  function startEdit(t) {
    setEditForm({
      amount: String(t.amount),
      category: t.category || (t.type === "expense" ? cats[0]?.id : incomeCats[0]?.id) || "",
      note: t.note || "",
      date: t.date,
    });
    setEditing(true);
  }

  async function saveEdit() {
    if (!editForm.amount || isNaN(+editForm.amount) || +editForm.amount <= 0)
      return showToast("Enter a valid amount", "error");
    setBusy(true);
    try {
      await apiHelpers.updateTransaction(detailTxn.id, {
        amount: +editForm.amount,
        categoryId: editForm.category || null,
        note: editForm.note || null,
        txnDate: editForm.date,
      });
      setDetailTxn(null);
      setEditing(false);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  const detailCat = detailTxn ? allCats.find((c) => c.id === detailTxn.category) : null;

  return (
    <div style={{ background: "#0a0f1e", minHeight: "100%", padding: "16px 16px 120px" }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Transactions</div>
      <div style={{ color: "#475569", fontSize: 12, marginBottom: 14 }}>{wallet.name}</div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", paddingBottom: 2 }}>
        {["all", "expense", "income"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "6px 14px", border: "none",
              background: tab === t ? "#22d3ee" : "#131c2e",
              color: tab === t ? "#0a0f1e" : "#94a3b8",
              borderRadius: 99, cursor: "pointer", fontSize: 12, fontWeight: 600,
              whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        <select
          style={{
            background: "#131c2e", border: "1px solid #1e293b", color: "#94a3b8",
            borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer",
            marginLeft: "auto", flexShrink: 0,
          }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {periods.map((p) => (
            <option key={p} value={p}>{periodLabel(p, msd)}</option>
          ))}
        </select>
      </div>

      {/* Transaction list */}
      {txns.length === 0 ? (
        <div style={{ color: "#475569", textAlign: "center", padding: 40, fontSize: 13 }}>No transactions found</div>
      ) : (
        txns.map((t) => {
          const cat = allCats.find((c) => c.id === t.category);
          return (
            <div
              key={t.id}
              onClick={() => openDetail(t)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 14px", background: "#131c2e",
                borderRadius: 12, marginBottom: 6, border: "1px solid #1e293b",
                cursor: "pointer",
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: (cat?.color || "#6b7280") + "22",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 19, flexShrink: 0,
              }}>
                {cat?.icon || "\u{1F4B1}"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {cat?.label || "Transaction"}
                </div>
                <div style={{ color: "#475569", fontSize: 11, marginTop: 1 }}>
                  {fmtDate(t.date)}{t.note ? " \u00B7 " + t.note : ""}
                </div>
              </div>
              <div style={{
                color: t.type === "income" ? "#10b981" : "#f87171",
                fontWeight: 700, fontSize: 13, flexShrink: 0, textAlign: "right",
              }}>
                {t.type === "income" ? "+" : "-"}{fmt(t.amount)}
              </div>
            </div>
          );
        })
      )}

      {/* Transaction detail / edit bottom sheet */}
      {detailTxn && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end" }}
          onClick={() => { setDetailTxn(null); setEditing(false); }}
        >
          <div
            style={{ background: "#131c2e", borderRadius: "20px 20px 0 0", padding: "16px 18px 44px", width: "100%", border: "1px solid #1e293b", boxSizing: "border-box", maxHeight: "85vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, background: "#1e293b", borderRadius: 99, margin: "0 auto 16px" }} />

            {!editing ? (
              <>
                {/* Header: icon + name + amount */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: (detailCat?.color || "#6b7280") + "22",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 26, flexShrink: 0,
                  }}>
                    {detailCat?.icon || "\u{1F4B1}"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{detailCat?.label || "Transaction"}</div>
                    <div style={{ color: "#475569", fontSize: 12 }}>{detailTxn.type === "income" ? "Income" : "Expense"}</div>
                  </div>
                  <div style={{ color: detailTxn.type === "income" ? "#10b981" : "#f87171", fontWeight: 900, fontSize: 18, textAlign: "right" }}>
                    {detailTxn.type === "income" ? "+" : "-"}{fmt(detailTxn.amount)}
                  </div>
                </div>

                {/* Details */}
                <div style={{ background: "#0a0f1e", borderRadius: 12, padding: "4px 14px", marginBottom: 16 }}>
                  {[
                    ["Date", fmtDate(detailTxn.date)],
                    ["Note", detailTxn.note || "\u2014"],
                    detailTxn.addedBy ? ["Added by", "@" + detailTxn.addedBy] : null,
                  ].filter(Boolean).map(([label, value], i, arr) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < arr.length - 1 ? "1px solid #1e293b" : "none" }}>
                      <span style={{ color: "#475569", fontSize: 12 }}>{label}</span>
                      <span style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={{ ...D.btn, flex: 1, padding: 12 }}
                    onClick={() => startEdit(detailTxn)}
                  >
                    {"\u270F\uFE0F"} Edit
                  </button>
                  <button
                    style={{ flex: 1, padding: 12, background: "#ef444420", border: "none", borderRadius: 9, color: "#f87171", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                    onClick={() => setConfirmId(detailTxn.id)}
                  >
                    {"\uD83D\uDDD1\uFE0F"} Delete
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Edit form */}
                <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 14 }}>Edit Transaction</div>
                <label style={{ color: "#94a3b8", fontSize: 11, display: "block", marginBottom: 4 }}>Amount (IDR)</label>
                <input
                  autoFocus
                  style={D.inp}
                  type="number"
                  placeholder="Amount"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                />
                <label style={{ color: "#94a3b8", fontSize: 11, display: "block", marginBottom: 4 }}>Category</label>
                <select
                  style={D.inp}
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                >
                  {(detailTxn.type === "expense" ? cats : incomeCats).map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                  ))}
                </select>
                <label style={{ color: "#94a3b8", fontSize: 11, display: "block", marginBottom: 4 }}>Note</label>
                <input
                  style={D.inp}
                  placeholder="Note (optional)"
                  value={editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                />
                <label style={{ color: "#94a3b8", fontSize: 11, display: "block", marginBottom: 4 }}>Date</label>
                <input
                  style={D.inp}
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    style={{ ...D.btn, flex: 1, padding: 12, opacity: busy ? 0.6 : 1 }}
                    onClick={saveEdit}
                    disabled={busy}
                  >
                    {busy ? "Saving\u2026" : "Save Changes"}
                  </button>
                  <button
                    style={{ padding: 12, background: "#1e293b", border: "none", borderRadius: 9, color: "#94a3b8", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {confirmId && (
        <ConfirmDialog
          title="Delete Transaction"
          message="This transaction will be permanently removed."
          onConfirm={() => del(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}
