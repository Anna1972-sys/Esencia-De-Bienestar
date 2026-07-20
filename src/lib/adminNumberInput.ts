export type AdminNumberValue = number | string;

export const numberInputValue = (value: string): AdminNumberValue =>
  value;

export const numberOrFallback = (value: unknown, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const countDecimals = (value: number) => {
  const text = value.toString();
  if (text.includes("e-")) return Number(text.split("e-")[1] ?? 0);
  return text.includes(".") ? text.split(".")[1].length : 0;
};

export const stableNutritionInputValue = (value: unknown): AdminNumberValue => {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed)) return "";
  if (parsed !== 0 && Math.abs(parsed) < 1 && countDecimals(parsed) < 2) {
    return parsed.toFixed(2);
  }
  return Number.isInteger(parsed) ? String(parsed) : String(parsed);
};

export const roundedNutritionInputValue = (value: number): AdminNumberValue =>
  stableNutritionInputValue(Number(value.toFixed(3)));

export const selectInitialZero = (input: HTMLInputElement) => {
  if (input.value !== "0") return;
  requestAnimationFrame(() => input.select());
};
