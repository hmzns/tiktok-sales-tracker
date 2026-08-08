export const ORDER_BUSINESS_TIME_ZONE = "Asia/Kuching";

type MonthPeriod = {
  year: number;
  month: number;
};

export type OrderComparisonPeriods = {
  current: MonthPeriod;
  previous: MonthPeriod;
};

export const getOrderComparisonPeriods = (
  now = new Date()
): OrderComparisonPeriods => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ORDER_BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error("Unable to determine the current business month");
  }

  return {
    current: { year, month },
    previous:
      month === 1
        ? { year: year - 1, month: 12 }
        : { year, month: month - 1 },
  };
};

/**
 * Returns null when growth has no previous-month baseline. This avoids
 * presenting a made-up percentage when the previous completed count is zero.
 */
export const calculateCompletedOrderMonthChange = (
  currentCompletedCount: number,
  previousCompletedCount: number
) => {
  if (previousCompletedCount === 0) {
    return currentCompletedCount === 0 ? 0 : null;
  }

  return (
    ((currentCompletedCount - previousCompletedCount) /
      previousCompletedCount) *
    100
  );
};
