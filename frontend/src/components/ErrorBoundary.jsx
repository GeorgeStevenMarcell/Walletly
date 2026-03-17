import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }
  render() {
    if (this.state.error)
      return (
        <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#1e1e2e", borderRadius: 16, padding: 24, maxWidth: 400, width: "100%", border: "1px solid #f8717155" }}>
            <div style={{ color: "#f87171", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Something went wrong</div>
            <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16, wordBreak: "break-word" }}>{this.state.error?.message || "Unknown error"}</div>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              style={{ background: "#22d3ee", color: "#0a0f1e", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    return this.props.children;
  }
}
