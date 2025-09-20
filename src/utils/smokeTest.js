// C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\src\utils\smokeTest.js
export function runToolbarSmokeTest(name, handlers) {
  try {
    const missing = Object.entries(handlers).filter(
      ([, fn]) => typeof fn !== "function"
    );
    if (missing.length) {
      console.warn(
        `[SmokeTest] ${name}: missing handlers: ${missing
          .map(([k]) => k)
          .join(", ")}`
      );
    } else {
      console.info(`[SmokeTest] ${name}: all handlers present`);
    }
    if (typeof window !== "undefined") {
      window.__bdSmoke = { ...(window.__bdSmoke || {}), [name]: Date.now() };
    }
  } catch (e) {
    console.warn("[SmokeTest] failed to run:", e);
  }
}
