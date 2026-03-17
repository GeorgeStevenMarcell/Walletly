export default function ConfirmDialog({ title, message, confirmLabel = "Delete", onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onCancel}>
      <div style={{ background: "#131c2e", borderRadius: 20, padding: "26px 22px", width: "100%", maxWidth: 310, border: "1px solid #1e293b", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#ef444420", border: "1.5px solid #ef444440", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 14px" }}>{"\u{1F5D1}\uFE0F"}</div>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 16, textAlign: "center", marginBottom: 8 }}>{title}</div>
        <div style={{ color: "#64748b", fontSize: 13, textAlign: "center", marginBottom: 24, lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "13px 0", border: "1px solid #1e293b", background: "#0a0f1e", color: "#94a3b8", borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Cancel</button>
          <button onClick={() => onConfirm()} style={{ flex: 1, padding: "13px 0", border: "none", background: "#ef4444", color: "#fff", borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
