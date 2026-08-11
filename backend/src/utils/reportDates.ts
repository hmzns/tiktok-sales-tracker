export type BusinessDateRange = {
  startDate: Date;
  endDate: Date;
};

export const BUSINESS_TIME_ZONE = "Asia/Kuching";

const padDatePart = (value: number) => String(value).padStart(2, "0");

/**
 * Reports use the backend process's local timezone for business-day boundaries.
 * Deployments for this application are configured for BUSINESS_TIME_ZONE
 * (UTC+08:00), matching the existing monthly report behaviour.
 */
export const formatBusinessDate = (value: Date) =>
  `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(
    value.getDate()
  )}`;

export const parseBusinessDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

export const addBusinessDays = (value: Date, days: number) => {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
};

export const getMonthRange = (year?: number, month?: number) => {
  const now = new Date();
  const selectedYear = year ?? now.getFullYear();
  const selectedMonth = month ?? now.getMonth() + 1;

  return {
    year: selectedYear,
    month: selectedMonth,
    startDate: new Date(selectedYear, selectedMonth - 1, 1),
    endDate: new Date(selectedYear, selectedMonth, 1),
  };
};

export const countBusinessDays = ({
  startDate,
  endDate,
}: BusinessDateRange) => {
  let count = 0;

  for (
    let cursor = new Date(startDate);
    cursor <= endDate;
    cursor = addBusinessDays(cursor, 1)
  ) {
    count += 1;
  }

  return count;
};
