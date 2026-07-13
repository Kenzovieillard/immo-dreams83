export type FieldErrors = Record<string, string>;

export function getStringField(payload: unknown, field: string) {
  if (!payload || typeof payload !== "object") return "";

  const value = (payload as Record<string, unknown>)[field];
  return typeof value === "string" ? value.trim() : "";
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function hasRequiredValue(value: string) {
  return value.trim().length > 0;
}

export function isPositiveNumberLike(value: string) {
  if (!value) return false;
  const normalized = value.replace(",", ".").replace(/\s/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0;
}
