export const CURRENCIES = [
  { code: "INR", name: "Indian Rupee" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "NPR", name: "Nepalese Rupee" },
  { code: "AED", name: "UAE Dirham" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "JPY", name: "Japanese Yen" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export const GYM_COUNTRIES = [
  { code: "IN", name: "India", currency: "INR" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "SG", name: "Singapore", currency: "SGD" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
  { code: "NZ", name: "New Zealand", currency: "NZD" },
  { code: "JP", name: "Japan", currency: "JPY" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "IE", name: "Ireland", currency: "EUR" },
] as const;

export type CountryCode = (typeof GYM_COUNTRIES)[number]["code"];

const localeByCurrency: Record<CurrencyCode, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "en-IE",
  GBP: "en-GB",
  BDT: "en-BD",
  NPR: "en-NP",
  AED: "en-AE",
  CAD: "en-CA",
  AUD: "en-AU",
  SGD: "en-SG",
  NZD: "en-NZ",
  JPY: "ja-JP",
};

export function formatMoney(amount: number | string, currency: string = "INR") {
  const safeCurrency = CURRENCIES.some((item) => item.code === currency) ? currency as CurrencyCode : "INR";
  return new Intl.NumberFormat(localeByCurrency[safeCurrency], {
    style: "currency",
    currency: safeCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: safeCurrency === "JPY" ? 0 : 2,
  }).format(Number(amount));
}

export function toMinorUnits(amount: number, currency: string) {
  const scale = currency === "JPY" ? 1 : 100;
  return Math.round(amount * scale);
}

export function fromMinorUnits(amount: number, currency: string) {
  const scale = currency === "JPY" ? 1 : 100;
  return amount / scale;
}
