const toFiniteNumber = (value: string) => {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

export const getNonNegativeNumberError = (
  value: string,
  message: string
) => {
  const parsedValue = toFiniteNumber(value);

  return parsedValue === null || parsedValue < 0 ? message : "";
};

export const getWholeNumberNonNegativeError = (value: string) => {
  const parsedValue = toFiniteNumber(value);

  return parsedValue === null || parsedValue < 0 || !Number.isInteger(parsedValue)
    ? "Stock must be a whole number."
    : "";
};

export const getPositiveAmountError = (value: string) => {
  const parsedValue = toFiniteNumber(value);

  return parsedValue === null || parsedValue <= 0
    ? "Amount must be more than 0."
    : "";
};
