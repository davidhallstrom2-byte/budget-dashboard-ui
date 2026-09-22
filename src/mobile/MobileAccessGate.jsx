// src/mobile/MobileAccessGate.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  Cloud,
  Download,
  LoaderCircle,
  Lock,
  LogOut,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import {
  exportMobileMigrationFile,
  getMobileStatus,
  importMobileMigrationFile,
  isLocalDevelopmentHost,
  loginMobileAccess,
  logoutMobileAccess,
  setupMobileAccess,
  stopCloudSync,
  subscribeCloudSyncStatus,
} from "./cloudSync";

const EMPTY_FORM = {
  email: "",
  password: "",
  confirmPassword: "",
  setupKey: "",
};

const SESSION_BAR_HEIGHT_CSS_VARIABLE = "--budget-session-bar-height";

function AccessScreen({ mode, error, onSubmit, onRetry }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [migrationFile, setMigrationFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const isSetup = mode === "setup";
  const unavailable = mode === "unavailable";

  const submit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (isSetup && form.password !== form.confirmPassword) {
      setFormError("The passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ ...form, migrationFile });
    } catch (submitError) {
      setFormError(submitError?.message || "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-10 text-slate-950">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-white/20 bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-blue-700 p-3 text-white">
            {unavailable ? (
              <Lock className="h-7 w-7" />
            ) : (
              <Smartphone className="h-7 w-7" />
            )}
          </div>

          <div>
            <h1 className="text-2xl font-black text-slate-950">
              Budget Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {isSetup
                ? "Create the private account for mobile access."
                : unavailable
                  ? "Mobile access needs one more setup step."
                  : "Sign in to access your synchronized apps."}
            </p>
          </div>
        </div>

        {unavailable ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
              {error || "The hosted mobile service is unavailable."}
            </div>

            <button
              type="button"
              onClick={onRetry}
              className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white hover:bg-blue-800"
            >
              Check Again
            </button>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={submit}>
            {isSetup ? (
              <label className="block text-sm font-bold text-slate-700">
                Setup key
                <input
                  type="password"
                  required
                  value={form.setupKey}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      setupKey: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>
            ) : null}

            <label className="block text-sm font-bold text-slate-700">
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Password
              <input
                type="password"
                autoComplete={isSetup ? "new-password" : "current-password"}
                minLength={isSetup ? 12 : undefined}
                required
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </label>

            {isSetup ? (
              <label className="block text-sm font-bold text-slate-700">
                Confirm password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                  value={form.confirmPassword}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>
            ) : null}

            <label className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm font-bold text-slate-700">
              Existing mobile-data file, optional
              <input
                type="file"
                accept="application/json,.json"
                onChange={(event) =>
                  setMigrationFile(event.target.files?.[0] || null)
                }
                className="mt-2 block w-full text-sm font-normal text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:font-bold file:text-white"
              />
            </label>

            {formError ? (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-900">
                {formError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white hover:bg-blue-800 disabled:cursor-wait disabled:bg-slate-400"
            >
              {submitting ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
              {submitting
                ? "Connecting..."
                : isSetup
                  ? "Create Private Account"
                  : "Sign In"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function MobileSessionBar({ localMode, email, onLogout }) {
  const sessionBarRef = useRef(null);
  const [status, setStatus] = useState({
    state: localMode ? "local" : "syncing",
    message: localMode ? "Local app" : "Connecting...",
  });

  useEffect(() => subscribeCloudSyncStatus(setStatus), []);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return undefined;
    }

    const root = document.documentElement;
    const sessionBar = sessionBarRef.current;

    const updateSessionBarHeight = () => {
      const height = sessionBar
        ? Math.ceil(sessionBar.getBoundingClientRect().height)
        : 0;

      root.style.setProperty(
        SESSION_BAR_HEIGHT_CSS_VARIABLE,
        `${Math.max(height, 0)}px`
      );
    };

    updateSessionBarHeight();
    window.addEventListener("resize", updateSessionBarHeight);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateSessionBarHeight)
        : null;

    if (sessionBar) {
      resizeObserver?.observe(sessionBar);
    }

    return () => {
      window.removeEventListener("resize", updateSessionBarHeight);
      resizeObserver?.disconnect();
      root.style.removeProperty(SESSION_BAR_HEIGHT_CSS_VARIABLE);
    };
  }, []);

  return (
    <div
      ref={sessionBarRef}
      className="sticky top-0 z-[100] border-b border-slate-700 bg-slate-950 px-3 py-2 text-white shadow-lg sm:py-1"
    >
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs font-bold sm:text-sm">
          <Cloud
            className={`h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5 ${
              status.state === "error" ? "text-red-400" : "text-cyan-400"
            }`}
          />

          <span className="truncate">
            {localMode
              ? "Local app, export data before first mobile setup"
              : status.message}
          </span>

          {!localMode && email ? (
            <span className="hidden text-slate-400 sm:inline">{email}</span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportMobileMigrationFile}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-700 px-2.5 text-xs font-black hover:bg-slate-600 sm:hidden"
          >
            <Download className="h-4 w-4" />
            Export Mobile Data
          </button>

          {!localMode ? (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-red-700 px-2.5 text-xs font-black hover:bg-red-800 sm:h-7"
            >
              <LogOut className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              Sign Out
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function MobileAccessGate({ children }) {
  const localMode = isLocalDevelopmentHost();
  const [mode, setMode] = useState(localMode ? "ready" : "loading");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    if (localMode) {
      document.documentElement.style.setProperty(
        SESSION_BAR_HEIGHT_CSS_VARIABLE,
        "0px"
      );
    }

    return () => {
      if (localMode) {
        document.documentElement.style.removeProperty(
          SESSION_BAR_HEIGHT_CSS_VARIABLE
        );
      }
    };
  }, [localMode]);

  const activateCloud = async (migrationFile = null) => {
    if (migrationFile) await importMobileMigrationFile(migrationFile);
    // Keep cloud synchronization disabled until deployment verification is approved.
    stopCloudSync();
    setMode("ready");
  };

  const checkStatus = async () => {
    if (localMode) return;

    setMode("loading");
    setError("");

    try {
      const status = await getMobileStatus();

      if (status.setupRequired) {
        setMode("setup");
        return;
      }

      if (!status.authenticated) {
        setMode("login");
        return;
      }

      setEmail(status.user?.email || "");
      await activateCloud();
    } catch (statusError) {
      setError(statusError?.message || "Could not reach the mobile service.");
      setMode("unavailable");
    }
  };

  useEffect(() => {
    checkStatus();
    return () => stopCloudSync();
    // The host does not change during the lifetime of the app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitAccess = async ({
    setupKey,
    email: submittedEmail,
    password,
    migrationFile,
  }) => {
    const normalizedEmail = String(submittedEmail || "").trim();

    if (mode === "setup") {
      await setupMobileAccess({
        setupKey,
        email: normalizedEmail,
        password,
      });
    } else {
      await loginMobileAccess({
        email: normalizedEmail,
        password,
      });
    }

    setEmail(normalizedEmail);
    await activateCloud(migrationFile);
  };

  const logout = async () => {
    stopCloudSync();

    try {
      await logoutMobileAccess();
    } finally {
      setEmail("");
      setMode("login");
    }
  };

  if (mode === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-5 py-4 font-bold shadow-xl">
          <LoaderCircle className="h-6 w-6 animate-spin text-cyan-400" />
          Connecting to your private dashboard...
        </div>
      </div>
    );
  }

  if (mode !== "ready") {
    return (
      <AccessScreen
        mode={mode}
        error={error}
        onSubmit={submitAccess}
        onRetry={checkStatus}
      />
    );
  }

  if (localMode) {
    return children;
  }

  return (
    <>
      <MobileSessionBar
        localMode={false}
        email={email}
        onLogout={logout}
      />
      {children}
    </>
  );
}
