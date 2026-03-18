const tokens = {
  shell: {
    display: "flex", flexDirection: "column",
    position: "fixed", top: 0, bottom: 0,
    left: "50%", transform: "translateX(-50%)",
    width: "100%", maxWidth: 500,
    background: "#0a0f1e", overflow: "hidden",
    fontFamily: "'Sora','Segoe UI',sans-serif", color: "#fff",
  },
  statusBar: {
    height: "env(safe-area-inset-top,0px)", background: "#0a0f1e", flexShrink: 0,
  },
  content: {
    flex: 1, overflowY: "auto", overflowX: "hidden",
  },
  bottomNav: {
    display: "flex", background: "#0d1526", borderTop: "1px solid #1e293b",
    paddingBottom: "env(safe-area-inset-bottom,0px)", flexShrink: 0, zIndex: 100,
  },
  navItem: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", padding: "9px 4px", border: "none",
    background: "transparent", color: "#334155", cursor: "pointer", gap: 2,
  },
  navActive: { color: "#22d3ee" },
  fab: {
    position: "fixed", bottom: "calc(env(safe-area-inset-bottom,0px) + 68px)",
    left: "50%", transform: "translateX(-50%)", width: 52, height: 52,
    borderRadius: "50%", background: "#22d3ee", border: "3px solid #0a0f1e",
    color: "#0a0f1e", fontSize: 26, fontWeight: 900, cursor: "pointer",
    boxShadow: "0 8px 24px rgba(34,211,238,0.35)", zIndex: 150,
    display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
  },
  inp: {
    width: "100%", background: "#0a0f1e", border: "1px solid #1e293b",
    borderRadius: 9, padding: "11px 12px", fontSize: 13, color: "#fff",
    marginBottom: 9, boxSizing: "border-box", outline: "none",
  },
  btn: {
    background: "#22d3ee", color: "#0a0f1e", border: "none",
    borderRadius: 9, padding: "10px 16px", fontWeight: 800,
    cursor: "pointer", fontSize: 13,
  },
};

export default tokens;
export { tokens as D };
