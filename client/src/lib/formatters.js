export const POSITION_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

export const VALUE_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value, symbol) {
  return symbol + VALUE_FORMATTER.format(Number.isFinite(value) ? value : 0);
}

export function formatTransactionDate(dateString) {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return "--";
  }

  return parsed.toLocaleString();
}

export function toDateTimeLocalValue(date = new Date()) {
  const nextDate = new Date(date);
  nextDate.setMinutes(nextDate.getMinutes() - nextDate.getTimezoneOffset());
  return nextDate.toISOString().slice(0, 16);
}

export function parseNumberInput(value) {
  const cleaned = String(value || "").replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}
