export function getRecurringAmount(subscription) {
  const basePrice = Number(subscription.basePrice) || 0;
  const discountValue = Number(subscription.discountValue) || 0;
  const discountedPrice = basePrice - (basePrice * discountValue) / 100;
  return Math.max(0, Number(discountedPrice.toFixed(2)));
}

export function formatDate(dateValue) {
  return new Date(dateValue).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function parseNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

export function normalizeFrequencies(frequencies) {
  if (!Array.isArray(frequencies)) {
    return [];
  }

  return frequencies
    .map((frequency) => frequency.trim().toUpperCase())
    .filter(Boolean);
}

