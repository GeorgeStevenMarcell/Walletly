import { useRef, useEffect } from "react";
import { todayStr, getPeriodDates } from "../utils/period";

export default function SpendChart({ wallet, mode, weekStart, prevWeekStart, prevWeekEnd, now, pk, msd, avg3 }) {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const W = c.offsetWidth || 280, H = 110;
    c.width = W; c.height = H;
    ctx.clearRect(0, 0, W, H);
    const pad = { t: 8, r: 8, b: 20, l: 8 };
    const gW = W - pad.l - pad.r, gH = H - pad.t - pad.b;

    if (mode === "week") {
      function inR(d, s, e) { const dt = new Date(d); return dt >= s && dt <= e; }
      const tw = wallet.transactions.filter((t) => t.type === "expense" && inR(t.date, weekStart, now)).reduce((s, t) => s + t.amount, 0);
      const pw = wallet.transactions.filter((t) => t.type === "expense" && inR(t.date, prevWeekStart, prevWeekEnd)).reduce((s, t) => s + t.amount, 0);
      const mx = Math.max(tw, pw, avg3 || 0, 1) * 1.15;
      const bw = gW * 0.25, gap = gW * 0.08;
      const x0 = pad.l + (gW - (bw * 2 + gap)) / 2;

      const ph = (pw / mx) * gH;
      ctx.fillStyle = "#f8717133";
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0, pad.t + gH - ph, bw, ph, 4); else ctx.rect(x0, pad.t + gH - ph, bw, ph); ctx.fill();

      const th = (tw / mx) * gH;
      ctx.fillStyle = "#f87171cc";
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0 + bw + gap, pad.t + gH - th, bw, th, 4); else ctx.rect(x0 + bw + gap, pad.t + gH - th, bw, th); ctx.fill();

      if (avg3 > 0) {
        const ay = pad.t + gH * (1 - avg3 / mx);
        ctx.save(); ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(pad.l, ay); ctx.lineTo(pad.l + gW, ay); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
      }

      ctx.fillStyle = "#334155"; ctx.font = "9px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("Last week", x0 + bw / 2, H - 3);
      ctx.fillText("This week", x0 + bw + gap + bw / 2, H - 3);
    } else {
      const { start, end } = getPeriodDates(pk, msd);
      const days = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d).toISOString().slice(0, 10));
      const vals = days.map((date) => wallet.transactions.filter((t) => t.type === "expense" && t.date === date).reduce((s, t) => s + t.amount, 0));
      const maxDayAvg = avg3 > 0 ? avg3 / days.length : 0;
      const mx = Math.max(...vals, maxDayAvg, 1) * 1.15;
      const bw = Math.max(2, (gW - days.length) / days.length);

      vals.forEach((v, i) => {
        const bh = Math.max(2, (v / mx) * gH);
        const x = pad.l + i * (bw + 1);
        const isToday = days[i] === todayStr();
        ctx.fillStyle = isToday ? "#22d3ee" : v > 0 ? "#22d3ee33" : "#1e293b44";
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, pad.t + gH - bh, bw, bh, 2); else ctx.rect(x, pad.t + gH - bh, bw, bh); ctx.fill();
      });

      if (avg3 > 0) {
        const avgDay = avg3 / days.length;
        const avgY = pad.t + gH * (1 - avgDay / mx);
        ctx.save(); ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(pad.l, avgY); ctx.lineTo(pad.l + gW, avgY); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
      }

      ctx.fillStyle = "#334155"; ctx.font = "9px sans-serif"; ctx.textAlign = "left";
      ctx.fillText(days[0]?.slice(5).replace("-", "/"), pad.l, H - 3);
      ctx.textAlign = "right";
      ctx.fillText(days[days.length - 1]?.slice(5).replace("-", "/"), pad.l + gW, H - 3);
    }

    ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t + gH); ctx.lineTo(pad.l + gW, pad.t + gH); ctx.stroke();
  });

  return <canvas ref={ref} style={{ width: "100%", height: 110, display: "block" }} />;
}
