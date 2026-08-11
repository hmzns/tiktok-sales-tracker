import type {
  ApiMoney,
  TikTokFinanceStatus,
  TikTokPaymentMode,
} from "../api/orders";

export const TIKTOK_PAYMENT_MODE_OPTIONS: {
  value: TikTokPaymentMode;
  label: string;
  shortLabel: string;
}[] = [
  {
    value: "FULL_TIKTOK",
    label: "Paid fully through TikTok Shop",
    shortLabel: "TikTok Shop",
  },
  {
    value: "EXTERNAL_PRODUCT_PAYMENT",
    label: "Product paid outside TikTok / WhatsApp",
    shortLabel: "Outside TikTok / WhatsApp",
  },
];

export const getTikTokPaymentModeLabel = (
  paymentMode: TikTokPaymentMode | null
) =>
  TIKTOK_PAYMENT_MODE_OPTIONS.find(
    (option) => option.value === paymentMode
  )?.shortLabel ?? "Not assigned";

export const formatTikTokFinanceStatus = (
  status: TikTokFinanceStatus | null
) => {
  if (!status) return "Not synced";

  return status
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getCurrencyLabel = (currency: string | null | undefined) => {
  const normalized = currency?.trim().toUpperCase();
  return !normalized || normalized === "MYR" ? "RM" : `${normalized} `;
};

export const formatFinanceMoney = (
  value: ApiMoney | null,
  currency: string | null | undefined,
  showPositiveSign = false
) => {
  if (value === null || value === "") return "Not available";

  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Not available";

  const sign = amount < 0 ? "-" : showPositiveSign && amount > 0 ? "+" : "";
  return `${sign}${getCurrencyLabel(currency)}${Math.abs(amount).toFixed(2)}`;
};

export const getTrackerProductRevenue = (
  subtotal: number,
  discount: number
) => Math.round((subtotal - discount + Number.EPSILON) * 100) / 100;
