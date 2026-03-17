export default function Toast({ msg, type }) {
  return (
    <div
      style={{
        position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)",
        padding: "10px 16px", borderRadius: 11, fontWeight: 600, fontSize: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 9999,
        background: type === "error" ? "#7f1d1d" : "#14532d",
        color: type === "error" ? "#fca5a5" : "#86efac",
        border: `1px solid ${type === "error" ? "#ef4444" : "#22c55e"}`,
        whiteSpace: "nowrap",
      }}
    >
      {type === "error" ? "\u274C" : "\u2705"} {msg}
    </div>
  );
}
