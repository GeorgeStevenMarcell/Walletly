import { useState, useEffect, useRef } from "react";
import { useWallet } from "../context/WalletContext";
import { useToast } from "../hooks/useToast";
import { fmt, fmtShort } from "../utils/format";
import { D } from "../styles/tokens";
import ConfirmDialog from "../components/ConfirmDialog";

export default function BudgetDetail({ cat, txns, pStart, pEnd, totalDays, daysPassed, daysLeft, startStr, endStr, onBack }) {
  const { wallet, apiHelpers } = useWallet();
  const { showToast } = useToast();
  const ref = useRef(null);

  const catTxns = txns.filter((t) => t.category === cat.id).sort((a, b) => a.date.localeCompare(b.date));
  const budget = (wallet.budgets || {})[cat.id] || 0;
  const spent = catTxns.reduce((s, t) => s + t.amount, 0);
  const over = budget > 0 && spent > budget;
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const recDaily = daysLeft > 0 ? (budget - spent) / daysLeft : 0;
  const actDaily = daysPassed > 0 ? spent / daysPassed : 0;
  const projected = actDaily * totalDays;

  const [edit, setEdit] = useState(false);
  const [editAmt, setEditAmt] = useState(String(budget));
  const [confirmDel, setConfirmDel] = useState(false);

  async function save() {
    try {
      await apiHelpers.upsertBudget(cat.id, +editAmt);
      setEdit(false);
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function del() {
    const budgetId = wallet._budgetRows?.find((b) => b.category_id === cat.id)?.id;
    try {
      await apiHelpers.deleteBudget(budgetId || cat.id);
      showToast("Removed");
      onBack();
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const W = c.offsetWidth || 280;
    const H = 150;
    c.width = W;
    c.height = H;
    ctx.clearRect(0, 0, W, H);

    const days = Array.from({ length: totalDays }, (_, i) => {
      const d = new Date(pStart);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });

    let cum = 0;
    const data = days.map((date) => {
      cum += catTxns.filter((t) => t.date === date).reduce((s, t) => s + t.amount, 0);
      return cum;
    });

    const maxVal = Math.max(budget > 0 ? budget * 1.1 : 0, Math.max(...data) * 1.05, 1);
    const pad = { t: 16, r: 8, b: 24, l: 44 };
    const gW = W - pad.l - pad.r;
    const gH = H - pad.t - pad.b;

    [0, 0.5, 1].forEach((f) => {
      const y = pad.t + gH * (1 - f);
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + gW, y);
      ctx.stroke();
      ctx.fillStyle = "#334155";
      ctx.font = "8px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(fmtShort(maxVal * f), pad.l - 3, y + 3);
    });

    if (budget > 0) {
      const by = pad.t + gH * (1 - budget / maxVal);
      ctx.strokeStyle = "#f8717155";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(pad.l, by);
      ctx.lineTo(pad.l + gW, by);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (data.length < 2) return;

    const lIdx = Math.min(daysPassed - 1, data.length - 1);
    const lVal = data[lIdx] || 0;
    if (lIdx < data.length - 1) {
      const x1 = pad.l + (lIdx / (data.length - 1)) * gW;
      const y1 = pad.t + gH * (1 - lVal / maxVal);
      const x2 = pad.l + gW;
      const y2 = pad.t + gH * (1 - projected / maxVal);
      ctx.strokeStyle = cat.color + "55";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    data.slice(0, daysPassed).forEach((v, i) => {
      const x = pad.l + (i / (data.length - 1)) * gW;
      const y = pad.t + gH * (1 - v / maxVal);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    const lx = pad.l + (Math.min(daysPassed - 1, data.length - 1) / (data.length - 1)) * gW;
    ctx.lineTo(lx, pad.t + gH);
    ctx.lineTo(pad.l, pad.t + gH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + gH);
    grad.addColorStop(0, cat.color + "88");
    grad.addColorStop(1, cat.color + "11");
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = cat.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    data.slice(0, daysPassed).forEach((v, i) => {
      const x = pad.l + (i / (data.length - 1)) * gW;
      const y = pad.t + gH * (1 - v / maxVal);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = "#334155";
    ctx.font = "8px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(startStr, pad.l, H - 2);
    ctx.fillText(endStr, pad.l + gW, H - 2);
  });

  return (
    <div style={{ background: "#0a0f1e", minHeight: "100%", padding: "16px 16px 120px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button
          onClick={onBack}
          style={{
            background: "#131c2e",
            border: "1px solid #1e293b",
            borderRadius: 9,
            padding: "7px 12px",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 13,
            color: "#94a3b8",
          }}
        >
          {"\u2190"}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>
            {cat.icon} {cat.label}
          </div>
          <div style={{ color: "#475569", fontSize: 11 }}>
            {startStr} \u2013 {endStr} · {daysLeft} days left
          </div>
        </div>
        <button
          onClick={() => setEdit(!edit)}
          style={{ background: "#1e293b", border: "none", borderRadius: 9, padding: "7px 11px", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}
        >
          {"\u270F\uFE0F"}
        </button>
        <button
          onClick={() => setConfirmDel(true)}
          style={{ background: "#ef444420", border: "none", borderRadius: 9, padding: "7px 11px", cursor: "pointer", color: "#f87171", fontSize: 12 }}
        >
          {"\uD83D\uDDD1\uFE0F"}
        </button>
      </div>

      <div style={{ background: "#131c2e", borderRadius: 14, padding: 14, marginBottom: 10, border: `1px solid ${cat.color}33` }}>
        <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 3 }}>Monthly Budget</div>
        {edit ? (
          <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
            <input
              autoFocus
              style={{ ...D.inp, margin: 0, flex: 1, fontSize: 16, fontWeight: 800 }}
              type="number"
              value={editAmt}
              onChange={(e) => setEditAmt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
            <button style={{ ...D.btn, padding: "9px 14px" }} onClick={save}>
              Save
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", fontFamily: "monospace", marginBottom: 10 }}>
            {budget > 0 ? fmt(budget) : <span style={{ color: "#475569" }}>No limit</span>}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 7 }}>
          <span style={{ color: "#94a3b8" }}>
            Spent <span style={{ color: "#fff", fontWeight: 700 }}>{fmt(spent)}</span>
          </span>
          {budget > 0 && (
            <span style={{ color: over ? "#f87171" : "#10b981", fontWeight: 700 }}>
              {over ? `Over ${fmt(spent - budget)}` : `${fmt(budget - spent)} left`}
            </span>
          )}
        </div>
        {budget > 0 && (
          <div style={{ position: "relative" }}>
            <div style={{ background: "#1e293b", borderRadius: 99, height: 7 }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  borderRadius: 99,
                  background: over ? "#ef4444" : pct > 75 ? "#f59e0b" : cat.color,
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
              <div style={{ fontSize: 8, color: "#94a3b8", marginTop: 1, whiteSpace: "nowrap" }}>Today</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ background: "#131c2e", borderRadius: 14, padding: 14, marginBottom: 10, border: "1px solid #1e293b" }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 12, marginBottom: 10 }}>{"\uD83D\uDCC8"} Spending Over Time</div>
        <canvas ref={ref} style={{ width: "100%", height: 150, display: "block" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 10 }}>
        {[
          ["\uD83D\uDCA1", fmt(Math.max(0, recDaily)), "Rec. daily", "#3b82f6"],
          ["\uD83D\uDCCA", fmt(projected), "Projected", projected > budget && budget > 0 ? "#f87171" : "#8b5cf6"],
          ["\u26A1", fmt(actDaily), "Daily avg", "#10b981"],
        ].map(([ico, val, lbl, col]) => (
          <div key={lbl} style={{ background: "#131c2e", borderRadius: 11, padding: "9px", border: "1px solid #1e293b" }}>
            <div style={{ fontSize: 14, marginBottom: 3 }}>{ico}</div>
            <div style={{ color: col, fontWeight: 800, fontSize: 12 }}>{val}</div>
            <div style={{ color: "#475569", fontSize: 9, marginTop: 2 }}>{lbl}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#131c2e", borderRadius: 14, overflow: "hidden", border: "1px solid #1e293b" }}>
        <div style={{ padding: "11px 14px", borderBottom: "1px solid #1e293b", color: "#fff", fontWeight: 700, fontSize: 12 }}>Transactions</div>
        {catTxns.length === 0 ? (
          <div style={{ padding: 18, color: "#475569", textAlign: "center", fontSize: 12 }}>No transactions</div>
        ) : (
          [...catTxns].reverse().map((t, i) => (
            <div
              key={t.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 14px",
                borderBottom: i < catTxns.length - 1 ? "1px solid #1e293b" : "none",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: cat.color + "22",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 17,
                  flexShrink: 0,
                }}
              >
                {cat.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 12 }}>{t.note || cat.label}</div>
                <div style={{ color: "#475569", fontSize: 10, marginTop: 1 }}>{t.date}</div>
              </div>
              <div style={{ color: "#f87171", fontWeight: 700, fontSize: 12 }}>-{fmtShort(t.amount)}</div>
            </div>
          ))
        )}
      </div>

      {confirmDel && (
        <ConfirmDialog
          title="Remove Budget"
          message={`Remove the budget limit for ${cat.label}?`}
          confirmLabel="Remove"
          onConfirm={del}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </div>
  );
}
