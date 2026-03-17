import { api } from "../api";

export default function LoadingScreen({ loading, loadError, onRetry, onSignOut }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: 20 }}>
      {loadError ? (
        <div style={{ background: "#1e1e2e", borderRadius: 16, padding: 24, maxWidth: 400, width: "100%", border: "1px solid #f8717155", textAlign: "center" }}>
          <div style={{ color: "#f87171", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Failed to load</div>
          <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>{loadError}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={onRetry} style={{ background: "#22d3ee", color: "#0a0f1e", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Retry</button>
            <button onClick={onSignOut} style={{ background: "#1e293b", color: "#94a3b8", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Sign Out</button>
          </div>
        </div>
      ) : (
        <div style={{ color: "#22d3ee", fontSize: 16, fontWeight: 600 }}>Loading\u2026</div>
      )}
    </div>
  );
}
