const PHONE_EXTENSION_PATTERN = /\s*(?:(?:ext(?:ension)?\.?|x)\s*:?\s*(\d+))\s*$/i;

const splitPhoneExtension = (value = "") => {
  const raw = String(value ?? "");
  const match = raw.match(PHONE_EXTENSION_PATTERN);

  if (!match) return { main: raw, extension: "" };

  return {
    main: raw.slice(0, match.index).trimEnd(),
    extension: match[1] || "",
  };
};

export const formatPhoneNumber = (value = "") => {
  const raw = String(value ?? "");
  if (!raw.trim()) return "";

  const { main, extension } = splitPhoneExtension(raw);
  const digits = main.replace(/\D/g, "");

  if (digits.length !== 10) return raw;

  const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return extension ? `${formatted} ext. ${extension}` : formatted;
};

export const formatPhoneInput = (value = "") => formatPhoneNumber(value);

