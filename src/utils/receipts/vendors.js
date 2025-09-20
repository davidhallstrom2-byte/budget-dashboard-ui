export const KNOWN_VENDORS = [
  { match: ["spectrum mobile"], categoryKey: "housing", label: "Spectrum Mobile" },
  { match: ["spectrum internet", "spectrum"], categoryKey: "housing", label: "Spectrum Internet" },
  { match: ["wells fargo"], categoryKey: "banking", label: "Wells Fargo Service Fee" },
  { match: ["credit one"], categoryKey: "banking", label: "Credit One Bank" },
  { match: ["chatgpt", "openai"], categoryKey: "homeOffice", label: "ChatGPT Plus" },
  { match: ["google ai"], categoryKey: "homeOffice", label: "Google AI Pro" },
  { match: ["linkedin"], categoryKey: "homeOffice", label: "LinkedIn Premium" },
  { match: ["supergrok", "grok"], categoryKey: "homeOffice", label: "SuperGrok (trial)" },
  { match: ["netflix"], categoryKey: "personal", label: "Netflix" },
  { match: ["hulu"], categoryKey: "personal", label: "Hulu" },
  { match: ["paramount"], categoryKey: "personal", label: "Paramount+" },
  { match: ["prime", "amazon prime"], categoryKey: "personal", label: "Prime" },
  { match: ["espn+"], categoryKey: "personal", label: "ESPN+" },
  { match: ["mlb.tv", "mlb"], categoryKey: "personal", label: "MLB.tv" },
  { match: ["moviepass"], categoryKey: "personal", label: "MoviePass" },
  { match: ["xbox game pass"], categoryKey: "personal", label: "Xbox Game Pass" },
  { match: ["cvs extracare", "cvs"], categoryKey: "personal", label: "CVS ExtraCare" },
  { match: ["uber one", "uber"], categoryKey: "transportation", label: "Uber One" },
  { match: ["instacart"], categoryKey: "food", label: "Instacart" },
  { match: ["grocery", "groceries"], categoryKey: "food", label: "Groceries" },
  { match: ["rent"], categoryKey: "housing", label: "Rent" }
];

export const CATEGORY_OPTIONS = [
  { key: "income", label: "Income" },
  { key: "housing", label: "Housing" },
  { key: "transportation", label: "Transportation" },
  { key: "food", label: "Food" },
  { key: "personal", label: "Personal" },
  { key: "homeOffice", label: "Home Office" },
  { key: "banking", label: "Banking & Credit" },
  { key: "misc", label: "Misc" }
];
