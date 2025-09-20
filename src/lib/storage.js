// src/lib/storage.js
const STATE_KEY = "bd/state";
const DARK_KEY = "bd/dark";

export const loadState = () => {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const saveState = (obj) => {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(obj));
  } catch {}
};

export const loadDark = () => {
  try {
    const raw = localStorage.getItem(DARK_KEY);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
};

export const saveDark = (value) => {
  try {
    localStorage.setItem(DARK_KEY, JSON.stringify(!!value));
  } catch {}
};
