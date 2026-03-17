import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { useToast } from "../hooks/useToast";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "../constants";
import { todayStr } from "../utils/period";
import { D } from "../styles/tokens";

export default function AddTxnSheet({ onClose }) {
  const { wallet, apiHelpers } = useWallet();
  const { showToast } = useToast();

  const cats = wallet.expenseCategories || DEFAULT_EXPENSE_CATEGORIES;
  const incomeCats = wallet.incomeCategories || DEFAULT_INCOME_CATEGORIES;
  const [form, setForm] = useState({ type: "expense", amount: "", category: cats[0]?.id || "other", note: "", date: todayStr() });
  const [busy, setBusy] = useState(false);
  const curCats = form.type === "expense" ? cats : incomeCats;

  async function save() {
    if (!form.amount || isNaN(+form.amount) || +form.amount <= 0) return showToast("Enter a valid amount", "error");
    setBusy(true);
    try {
      await apiHelpers.addTransaction({ type: form.type, amount: +form.amount, category: form.category, note: form.note, date: form.date });
      onClose();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div
        style={{ background: "#131c2e", borderRadius: "20px 20px 0 0", padding: "16px 18px 40px", width: "100%", border: "1px solid #1e293b", boxSizing: "border-box" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 36, height: 4, background: "#1e293b", borderRadius: 99, margin: "0 auto 16px" }} />
        <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 14 }}>Add Transaction</div>
        <div style={{ display: "flex", background: "#0a0f1e", borderRadius: 10, padding: 3, marginBottom: 12 }}>
          {["expense", "income"].map((t) => (
            <button
              key={t}
              onClick={() => setForm({ ...form, type: t, category: (t === "expense" ? cats[0]?.id : incomeCats[0]?.id) || "other" })}
              style={{
                flex: 1, padding: "9px 0", border: "none",
                background: form.type === t ? (t === "income" ? "#10b981" : "#ef4444") : "transparent",
                cursor: "pointer", borderRadius: 8, fontWeight: 700, color: "#fff", fontSize: 13,
              }}
            >
              {t === "income" ? "\u2191 Income" : "\u2193 Expense"}
            </button>
          ))}
        </div>
        <input style={D.inp} type="number" placeholder="Amount (IDR)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <select style={D.inp} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {curCats.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </select>
        <input style={D.inp} placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <input style={D.inp} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <button
          style={{ ...D.btn, width: "100%", padding: 13, fontSize: 14, marginTop: 2, opacity: busy ? 0.6 : 1 }}
          onClick={save}
          disabled={busy}
        >
          {busy ? "Saving\u2026" : "Save Transaction"}
        </button>
      </div>
    </div>
  );
}
