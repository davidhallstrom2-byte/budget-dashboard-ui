// C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\src\utils\ErrorBoundary.jsx
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }
  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof this.props.onReset === "function") this.props.onReset();
  };
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl border bg-red-50">
          <h3 className="text-lg font-semibold">Something went wrong</h3>
          <p className="text-sm mt-1">
            The tab failed to render. Try resetting or switching tabs.
          </p>
          <div className="mt-3">
            <button
              className="px-3 py-2 rounded-md border bg-white"
              onClick={this.handleReset}
            >
              Reset Tab
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
