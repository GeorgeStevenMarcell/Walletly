import { useState } from "react";
import Toast from "../components/Toast";

export default function AuthScreen({ onLogin, onRegister, showToast, toast }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", password: "", name: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function handle() {
    setErr(""); setBusy(true);
    try {
      if (mode === "login") {
        if (!form.username || !form.password) return setErr("All fields required.");
        await onLogin(form.username, form.password);
      } else {
        if (!form.username || !form.password || !form.name) return setErr("All fields required.");
        await onRegister(form.username, form.password, form.name);
        showToast("Welcome! \u{1F389}");
      }
    } catch (e) { setErr(e.message || "Something went wrong"); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0a0f1e,#111827 60%,#0a0f1e)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      <div style={{ background: "#161d2e", borderRadius: 24, padding: "36px 28px", width: "100%", maxWidth: 380, boxShadow: "0 32px 64px rgba(0,0,0,0.5)", border: "1px solid #1e293b" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{"\u{1F4B3}"}</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: "-1px" }}>Walletly</h1>
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>Smart budget tracking</p>
        </div>
        <div style={{ display: "flex", background: "#0a0f1e", borderRadius: 10, padding: 3, marginBottom: 18 }}>
          {["login", "register"].map((t) => (
            <button key={t} onClick={() => { setMode(t); setErr(""); }}
              style={{ flex: 1, padding: "9px 0", border: "none", background: mode === t ? "#22d3ee" : "transparent", color: mode === t ? "#0a0f1e" : "#94a3b8", cursor: "pointer", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
              {t === "login" ? "Sign in" : "Register"}
            </button>
          ))}
        </div>
        {err && <div style={{ color: "#fca5a5", fontSize: 12, marginBottom: 10, background: "#7f1d1d", padding: "8px 10px", borderRadius: 8 }}>{err}</div>}
        {mode === "register" && (
          <input
            style={{ width: "100%", background: "#0a0f1e", border: "1px solid #1e293b", borderRadius: 9, padding: "11px 12px", fontSize: 13, color: "#fff", marginBottom: 9, boxSizing: "border-box", outline: "none" }}
            placeholder="Display name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        )}
        <input
          style={{ width: "100%", background: "#0a0f1e", border: "1px solid #1e293b", borderRadius: 9, padding: "11px 12px", fontSize: 13, color: "#fff", marginBottom: 9, boxSizing: "border-box", outline: "none" }}
          placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <input
          type="password"
          style={{ width: "100%", background: "#0a0f1e", border: "1px solid #1e293b", borderRadius: 9, padding: "11px 12px", fontSize: 13, color: "#fff", marginBottom: 14, boxSizing: "border-box", outline: "none" }}
          placeholder="Password" value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && handle()}
        />
        <button
          style={{ width: "100%", background: "#22d3ee", color: "#0a0f1e", border: "none", borderRadius: 9, padding: "12px 0", fontWeight: 800, cursor: "pointer", fontSize: 14, opacity: busy ? 0.6 : 1 }}
          onClick={handle} disabled={busy}
        >
          {busy ? "Please wait\u2026" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </div>
    </div>
  );
}
