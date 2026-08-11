export const MONEY_SCALE = 100;

export const toMoneyCents = (value: number) =>
  Math.round((value + Number.EPSILON) * MONEY_SCALE);

export const fromMoneyCents = (value: number) => value / MONEY_SCALE;

export const roundMoney = (value: number) =>
  fromMoneyCents(toMoneyCents(value));

/**
 * Allocate a discount in whole cents using the largest-remainder method.
 * Ties are resolved by original item order, keeping allocation deterministic.
 */
export const allocateDiscountCents = (
  lineGrossCents: number[],
  discountCents: number
) => {
  const subtotalCents = lineGrossCents.reduce(
    (sum, lineAmount) => sum + lineAmount,
    0
  );

  if (discountCents === 0) {
    return lineGrossCents.map(() => 0);
  }

  if (subtotalCents <= 0 || discountCents < 0 || discountCents > subtotalCents) {
    throw new Error("Discount cannot be allocated to this subtotal");
  }

  const shares = lineGrossCents.map((lineAmount, index) => {
    const numerator = discountCents * lineAmount;

    return {
      index,
      allocated: Math.floor(numerator / subtotalCents),
      remainder: numerator % subtotalCents,
    };
  });
  const allocatedBase = shares.reduce(
    (sum, share) => sum + share.allocated,
    0
  );
  let remainingCents = discountCents - allocatedBase;

  const remainderOrder = [...shares].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index
  );

  for (const share of remainderOrder) {
    if (remainingCents === 0) break;

    share.allocated += 1;
    remainingCents -= 1;
  }

  return shares
    .sort((a, b) => a.index - b.index)
    .map((share, index) => {
      if (share.allocated > lineGrossCents[index]) {
        throw new Error("Allocated discount exceeds line revenue");
      }

      return share.allocated;
    });
};
