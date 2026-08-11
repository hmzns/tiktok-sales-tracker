const unavailableDateLabel = "Not available";

export const formatLocalDateTime = (
  value: string | null | undefined
): string => {
  if (!value) {
    return unavailableDateLabel;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return unavailableDateLabel;
  }

  try {
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return unavailableDateLabel;
  }
};
