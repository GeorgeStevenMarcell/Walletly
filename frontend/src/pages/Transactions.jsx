import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { useToast } from "../hooks/useToast";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "../constants";
import { getCurrentPeriodKey, getPeriodKey, periodLabel } from "../utils/period";
import { fmtShort } from "../utils/format";
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
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  return (
    <div style={{ background: "#0a0f1e", minHeight: "100%", padding: "16px 16px 120px" }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Transactions</div>
      <div style={{ color: "#475569", fontSize: 12, marginBottom: 14 }}>{wallet.name}</div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", paddingBottom: 2 }}>
        {["all", "expense", "income"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "6px 14px",
              border: "none",
              background: tab === t ? "#22d3ee" : "#131c2e",
              color: tab === t ? "#0a0f1e" : "#94a3b8",
              borderRadius: 99,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        <select
          style={{
            background: "#131c2e",
            border: "1px solid #1e293b",
            color: "#94a3b8",
            borderRadius: 8,
            padding: "5px 10px",
            fontSize: 11,
            cursor: "pointer",
            marginLeft: "auto",
            flexShrink: 0,
          }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {periodLabel(p, msd)}
            </option>
          ))}
        </select>
      </div>

      {txns.length === 0 ? (
        <div style={{ color: "#475569", textAlign: "center", padding: 40, fontSize: 13 }}>No transactions found</div>
      ) : (
        txns.map((t) => {
          const cat = allCats.find((c) => c.id === t.category);
          return (
            <div
              key={t.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                background: "#131c2e",
                borderRadius: 12,
                marginBottom: 6,
                border: "1px solid #1e293b",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 11,
                  background: (cat?.color || "#6b7280") + "22",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 19,
                  flexShrink: 0,
                }}
              >
                {cat?.icon || "\u{1F4B1}"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 13,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cat?.label || "Transaction"}
                </div>
                <div style={{ color: "#475569", fontSize: 11, marginTop: 1 }}>
                  {t.date} · {t.note || "\u2014"}
                </div>
              </div>
              <div
                style={{
                  color: t.type === "income" ? "#10b981" : "#f87171",
                  fontWeight: 700,
                  fontSize: 13,
                  flexShrink: 0,
                  marginRight: 6,
                }}
              >
                {t.type === "income" ? "+" : "-"}
                {fmtShort(t.amount)}
              </div>
              <button
                onClick={() => setConfirmId(t.id)}
                style={{
                  background: "#ef444420",
                  border: "none",
                  color: "#f87171",
                  borderRadius: 7,
                  padding: "3px 7px",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 11,
                  flexShrink: 0,
                }}
              >
                {"\u2715"}
              </button>
            </div>
          );
        })
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
