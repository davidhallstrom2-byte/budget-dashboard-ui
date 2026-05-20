// C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\src\components\ui\ErrorBoundary.jsx
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, err: null };
  }

  static getDerivedStateFromError(err) {
    return { hasError: true, err };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 16,
            margin: 8,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            borderRadius: 8,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Something went wrong.</div>
          <div style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
            {String(this.state.err?.message || this.state.err || "Unknown error")}
          </div>
          {this.props.onReset && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={this.props.onReset}
                style={{
                  fontSize: 13,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Reset
              </button>
            </div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
