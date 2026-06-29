export type AdminNumberValue = number | string;

export const numberInputValue = (value: string): AdminNumberValue =>
  value;

export const numberOrFallback = (value: unknown, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const selectInitialZero = (input: HTMLInputElement) => {
  if (input.value !== "0") return;
  requestAnimationFrame(() => input.select());
};
