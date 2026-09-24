const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_CALENDAR_SCOPE = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendars",
].join(" ");
const GOOGLE_CALENDAR_ENDPOINT =
  "https://www.googleapis.com/calendar/v3/calendars/primary";
const GOOGLE_CALENDAR_API_ROOT =
  "https://www.googleapis.com/calendar/v3/calendars";
const GOOGLE_CALENDAR_EVENTS_ENDPOINT =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

const GOOGLE_TOKEN_STORAGE_KEY = "googleCalendarApi.accessToken.v3";
const GOOGLE_TOKEN_EXPIRES_AT_STORAGE_KEY = "googleCalendarApi.accessTokenExpiresAt.v3";
const LEGACY_GOOGLE_TOKEN_STORAGE_KEYS = [
  "googleCalendarApi.accessToken.v2",
  "googleCalendarApi.accessTokenExpiresAt.v2",
  "googleCalendarApi.accessToken.v1",
  "googleCalendarApi.accessTokenExpiresAt.v1",
];

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
  LEGACY_GOOGLE_TOKEN_STORAGE_KEYS.forEach((storageKey) => {
    localStorage.removeItem(storageKey);
  });
};

const requestGoogleCalendarAccessToken = (clientId) => {
  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google Identity Services is not available.");
  }

  if (pendingTokenRequest) {
    return pendingTokenRequest;
  }

  pendingTokenRequest = new Promise((resolve, reject) => {
    googleTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_CALENDAR_SCOPE,
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

    // This call must happen during a user gesture whenever authorization is
    // required. The GIS script is preloaded below so a calendar button click
    // can open Google's consent window without first awaiting script loading.
    googleTokenClient.requestAccessToken({ prompt: "consent" });
  });

  return pendingTokenRequest;
};

export const getGoogleCalendarAccessToken = async ({ interactive = true } = {}) => {
  const existingToken = readStoredAccessToken();

  if (existingToken) {
    return existingToken;
  }

  if (!interactive) {
    return "";
  }

  const clientId = getGoogleCalendarClientId();

  if (!clientId) {
    throw new Error(
      "Missing Google Calendar Client ID. Add VITE_GOOGLE_CALENDAR_CLIENT_ID to .env.local or save googleCalendar.clientId in localStorage."
    );
  }

  // In the normal path the script has already been preloaded, so there is no
  // await before requestAccessToken and the browser still recognizes the
  // original calendar-button click as the popup-opening user gesture.
  if (!window.google?.accounts?.oauth2) {
    await loadGoogleIdentityScript();
  }

  return requestGoogleCalendarAccessToken(clientId);
};

if (typeof window !== "undefined" && typeof document !== "undefined") {
  loadGoogleIdentityScript().catch((error) => {
    console.warn("Google Identity Services preload failed:", error);
  });
}

const readGoogleCalendarResponse = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearGoogleCalendarAccessToken();
    }

    const apiMessage = String(data?.error?.message || "").trim();
    const error = new Error(
      apiMessage
        ? `${fallbackMessage} ${apiMessage}`
        : `${fallbackMessage} Status ${response.status}.`
    );
    error.status = response.status;
    throw error;
  }

  return data;
};

const buildGoogleCalendarEventsEndpoint = (eventId = "", eventPayload = {}) => {
  const normalizedEventId = String(eventId || "").trim();
  const endpoint = normalizedEventId
    ? `${GOOGLE_CALENDAR_EVENTS_ENDPOINT}/${encodeURIComponent(normalizedEventId)}`
    : GOOGLE_CALENDAR_EVENTS_ENDPOINT;
  const url = new URL(endpoint);

  if (String(eventPayload?.eventLabelId || "").trim()) {
    url.searchParams.set("eventLabelVersion", "1");
  }

  return url.toString();
};

const buildGoogleCalendarEndpoint = (calendarId = "primary") =>
  `${GOOGLE_CALENDAR_API_ROOT}/${encodeURIComponent(
    String(calendarId || "primary").trim() || "primary"
  )}`;

export const ensureGoogleCalendarEventLabel = async ({
  id,
  backgroundColor,
  name = "",
}) => {
  const normalizedId = String(id || "").trim();
  const normalizedBackgroundColor = String(backgroundColor || "").trim();
  const normalizedName = String(name || "").trim();

  if (!normalizedId || !normalizedBackgroundColor) {
    throw new Error(
      "Google Calendar label ID and background color are required."
    );
  }

  const token = await getGoogleCalendarAccessToken();
  const requestHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const calendarResponse = await fetch(GOOGLE_CALENDAR_ENDPOINT, {
    headers: requestHeaders,
  });
  const calendar = await readGoogleCalendarResponse(
    calendarResponse,
    "Google Calendar label lookup failed."
  );
  const existingLabels = Array.isArray(calendar?.labelProperties?.eventLabels)
    ? calendar.labelProperties.eventLabels
    : [];
  const existingLabel = existingLabels.find(
    (label) => String(label?.id || "").trim() === normalizedId
  );

  if (
    existingLabel &&
    String(existingLabel.backgroundColor || "").toLowerCase() ===
      normalizedBackgroundColor.toLowerCase() &&
    String(existingLabel.name || "").trim() === normalizedName
  ) {
    return existingLabel;
  }

  const updatedLabel = {
    id: normalizedId,
    backgroundColor: normalizedBackgroundColor,
    ...(normalizedName ? { name: normalizedName } : {}),
  };
  const updatedLabels = [
    ...existingLabels.filter(
      (label) => String(label?.id || "").trim() !== normalizedId
    ),
    updatedLabel,
  ];
  const resolvedCalendarId = String(calendar?.id || "primary").trim() || "primary";
  const calendarUpdatePayload = {
    summary: String(calendar?.summary || "").trim(),
    description: String(calendar?.description || ""),
    location: String(calendar?.location || ""),
    timeZone: String(calendar?.timeZone || ""),
    labelProperties: {
      eventLabels: updatedLabels,
    },
  };
  const updateResponse = await fetch(buildGoogleCalendarEndpoint(resolvedCalendarId), {
    method: "PUT",
    headers: requestHeaders,
    body: JSON.stringify(calendarUpdatePayload),
  });

  await readGoogleCalendarResponse(
    updateResponse,
    "Google Calendar label setup failed."
  );

  return updatedLabel;
};

export const listGoogleCalendarEvents = async ({
  timeMin = "",
  timeMax = "",
  query = "",
  maxResults = 2500,
  interactive = true,
} = {}) => {
  const token = await getGoogleCalendarAccessToken({ interactive });
  const events = [];

  // Background verification must never trigger Google's consent popup. If no
  // valid token is already stored, return no remote rows and let persisted CSC
  // calendar linkage remain authoritative until the user clicks a calendar
  // action and authorizes interactively.
  if (!token) return events;
  let pageToken = "";
  const safeMaxResults = Math.min(
    Math.max(Number(maxResults) || 2500, 1),
    2500
  );

  do {
    const url = new URL(GOOGLE_CALENDAR_EVENTS_ENDPOINT);

    if (timeMin) {
      const parsedTimeMin = new Date(timeMin);
      if (!Number.isFinite(parsedTimeMin.getTime())) {
        throw new Error("Invalid Google Calendar timeMin value.");
      }
      url.searchParams.set("timeMin", parsedTimeMin.toISOString());
    }

    if (timeMax) {
      const parsedTimeMax = new Date(timeMax);
      if (!Number.isFinite(parsedTimeMax.getTime())) {
        throw new Error("Invalid Google Calendar timeMax value.");
      }
      url.searchParams.set("timeMax", parsedTimeMax.toISOString());
    }

    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("showDeleted", "false");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", String(safeMaxResults));

    if (String(query || "").trim()) {
      url.searchParams.set("q", String(query).trim());
    }

    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await readGoogleCalendarResponse(
      response,
      "Google Calendar event lookup failed."
    );

    if (Array.isArray(data?.items)) {
      events.push(...data.items);
    }

    pageToken = String(data?.nextPageToken || "").trim();
  } while (pageToken);

  return events;
};

export const createGoogleCalendarEvent = async (eventPayload) => {
  const token = await getGoogleCalendarAccessToken();

  const response = await fetch(buildGoogleCalendarEventsEndpoint("", eventPayload), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventPayload),
  });

  return readGoogleCalendarResponse(
    response,
    "Google Calendar event creation failed."
  );
};

export const updateGoogleCalendarEvent = async (eventId, eventPayload) => {
  const normalizedEventId = String(eventId || "").trim();

  if (!normalizedEventId) {
    throw new Error("Missing Google Calendar event ID. The existing calendar event could not be updated.");
  }

  const token = await getGoogleCalendarAccessToken();
  const endpoint = buildGoogleCalendarEventsEndpoint(
    normalizedEventId,
    eventPayload
  );

  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventPayload),
  });

  return readGoogleCalendarResponse(
    response,
    "Google Calendar event update failed."
  );
};

export const deleteGoogleCalendarEvent = async (eventId) => {
  const normalizedEventId = String(eventId || "").trim();

  if (!normalizedEventId) {
    throw new Error("Missing Google Calendar event ID. The old calendar event could not be deleted.");
  }

  const token = await getGoogleCalendarAccessToken();
  const endpoint = buildGoogleCalendarEventsEndpoint(normalizedEventId);
  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // Google may return 404 or 410 when the event was already removed.
  // Treat that as a successful synchronization because the stale event is gone.
  if (response.status === 404 || response.status === 410) {
    return {
      id: normalizedEventId,
      deleted: true,
      alreadyMissing: true,
    };
  }

  await readGoogleCalendarResponse(
    response,
    "Google Calendar event deletion failed."
  );

  return {
    id: normalizedEventId,
    deleted: true,
    alreadyMissing: false,
  };
};
