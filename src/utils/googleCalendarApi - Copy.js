const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const GOOGLE_CALENDAR_EVENTS_ENDPOINT =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

const GOOGLE_TOKEN_STORAGE_KEY = "googleCalendarApi.accessToken.v1";
const GOOGLE_TOKEN_EXPIRES_AT_STORAGE_KEY = "googleCalendarApi.accessTokenExpiresAt.v1";

let googleIdentityScriptPromise = null;
let googleTokenClient = null;
let pendingTokenRequest = null;

const getGoogleCalendarClientId = () => {
  const envClientId = import.meta.env?.VITE_GOOGLE_CALENDAR_CLIENT_ID || "";
  const savedClientId = localStorage.getItem("googleCalendar.clientId") || "";

  return String(envClientId || savedClientId).trim();
};

const loadGoogleIdentityScript = () => {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  if (googleIdentityScriptPromise) {
    return googleIdentityScriptPromise;
  }

  googleIdentityScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      `script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Google Identity Services failed to load.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Google Identity Services failed to load."));

    document.head.appendChild(script);
  });

  return googleIdentityScriptPromise;
};

const readStoredAccessToken = () => {
  const token = localStorage.getItem(GOOGLE_TOKEN_STORAGE_KEY);
  const expiresAt = Number(
    localStorage.getItem(GOOGLE_TOKEN_EXPIRES_AT_STORAGE_KEY) || 0
  );

  if (!token || !expiresAt || Date.now() >= expiresAt - 60000) {
    return "";
  }

  return token;
};

const storeAccessToken = (tokenResponse) => {
  if (!tokenResponse?.access_token) {
    return "";
  }

  const expiresInSeconds = Number(tokenResponse.expires_in || 3600);
  const expiresAt = Date.now() + expiresInSeconds * 1000;

  localStorage.setItem(GOOGLE_TOKEN_STORAGE_KEY, tokenResponse.access_token);
  localStorage.setItem(GOOGLE_TOKEN_EXPIRES_AT_STORAGE_KEY, String(expiresAt));

  return tokenResponse.access_token;
};

export const clearGoogleCalendarAccessToken = () => {
  localStorage.removeItem(GOOGLE_TOKEN_STORAGE_KEY);
  localStorage.removeItem(GOOGLE_TOKEN_EXPIRES_AT_STORAGE_KEY);
};

export const getGoogleCalendarAccessToken = async () => {
  const existingToken = readStoredAccessToken();

  if (existingToken) {
    return existingToken;
  }

  const clientId = getGoogleCalendarClientId();

  if (!clientId) {
    throw new Error(
      "Missing Google Calendar Client ID. Add VITE_GOOGLE_CALENDAR_CLIENT_ID to .env.local or save googleCalendar.clientId in localStorage."
    );
  }

  await loadGoogleIdentityScript();

  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google Identity Services is not available.");
  }

  if (pendingTokenRequest) {
    return pendingTokenRequest;
  }

  pendingTokenRequest = new Promise((resolve, reject) => {
    googleTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_CALENDAR_EVENTS_SCOPE,
      callback: (tokenResponse) => {
        pendingTokenRequest = null;

        if (tokenResponse?.error) {
          reject(
            new Error(tokenResponse.error_description || tokenResponse.error)
          );
          return;
        }

        const token = storeAccessToken(tokenResponse);

        if (!token) {
          reject(
            new Error(
              "Google Calendar authorization did not return an access token."
            )
          );
          return;
        }

        resolve(token);
      },
      error_callback: (error) => {
        pendingTokenRequest = null;
        reject(
          new Error(
            error?.message ||
              error?.type ||
              "Google Calendar authorization failed."
          )
        );
      },
    });

    googleTokenClient.requestAccessToken({ prompt: "consent" });
  });

  return pendingTokenRequest;
};

export const createGoogleCalendarEvent = async (eventPayload) => {
  const token = await getGoogleCalendarAccessToken();

  const response = await fetch(GOOGLE_CALENDAR_EVENTS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventPayload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearGoogleCalendarAccessToken();
    }

    throw new Error(
      data?.error?.message ||
        `Google Calendar event creation failed with status ${response.status}.`
    );
  }

  return data;
};