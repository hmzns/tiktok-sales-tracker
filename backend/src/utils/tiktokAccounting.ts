import { fromMoneyCents, toMoneyCents } from "./orderFinancials";

export type TikTokPaymentModeValue =
  | "FULL_TIKTOK"
  | "EXTERNAL_PRODUCT_PAYMENT";

type HistoricalCostItem = {
  quantity: number;
  costPrice: number;
};

type DecimalCompatible =
  | number
  | string
  | { toNumber: () => number }
  | null;

const toNumber = (value: DecimalCompatible) => {
  if (value && typeof value === "object") {
    return value.toNumber();
  }

  return value === null ? null : Number(value);
};

export const getHistoricalCostCents = (items: HistoricalCostItem[]) =>
  items.reduce(
    (sum, item) => sum + toMoneyCents(item.costPrice * item.quantity),
    0
  );

export const calculateTikTokOrderProfit = ({
  paymentMode,
  financeStatus,
  settlementAmount,
  subtotal,
  discount,
  items,
}: {
  paymentMode: TikTokPaymentModeValue;
  financeStatus: string | null;
  settlementAmount: DecimalCompatible;
  subtotal: number;
  discount: number;
  items: HistoricalCostItem[];
}) => {
  const settlement = toNumber(settlementAmount);
  const hasSettlement = financeStatus === "SETTLED" && settlement !== null;
  const historicalCostCents = getHistoricalCostCents(items);

  if (paymentMode === "FULL_TIKTOK") {
    return hasSettlement
      ? fromMoneyCents(toMoneyCents(settlement) - historicalCostCents)
      : null;
  }

  const trackerNetProductRevenueCents =
    toMoneyCents(subtotal) - toMoneyCents(discount);

  return fromMoneyCents(
    trackerNetProductRevenueCents +
      (hasSettlement ? toMoneyCents(settlement) : 0) -
      historicalCostCents
  );
};

export const getRecognizedOrderFinancials = ({
  source,
  paymentMode,
  financeStatus,
  settlementAmount,
  subtotal,
  discount,
  total,
  totalCost,
  profit,
  items,
}: {
  source: "MANUAL" | "TIKTOK";
  paymentMode: TikTokPaymentModeValue | null;
  financeStatus: string | null;
  settlementAmount: DecimalCompatible;
  subtotal: number;
  discount: number;
  total: number;
  totalCost: number;
  profit: number | null;
  items: HistoricalCostItem[];
}) => {
  if (source !== "TIKTOK" || !paymentMode) {
    return {
      revenue: total,
      cost: totalCost,
      profit: profit ?? 0,
      pending: false,
    };
  }

  const settlement = toNumber(settlementAmount);
  const hasSettlement = financeStatus === "SETTLED" && settlement !== null;
  const calculatedProfit = calculateTikTokOrderProfit({
    paymentMode,
    financeStatus,
    settlementAmount,
    subtotal,
    discount,
    items,
  });

  if (paymentMode === "FULL_TIKTOK") {
    return hasSettlement
      ? {
          revenue: settlement,
          cost: fromMoneyCents(getHistoricalCostCents(items)),
          profit: calculatedProfit,
          pending: false,
        }
      : { revenue: null, cost: null, profit: null, pending: true };
  }

  return {
    revenue: fromMoneyCents(
      toMoneyCents(subtotal) -
        toMoneyCents(discount) +
        (hasSettlement ? toMoneyCents(settlement) : 0)
    ),
    cost: fromMoneyCents(getHistoricalCostCents(items)),
    profit: calculatedProfit,
    pending: false,
  };
};
