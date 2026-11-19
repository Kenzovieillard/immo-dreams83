export function commercialApiErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Erreur inconnue";
}

export function isCommercialConflictError(message: string) {
  return /NOT_FOUND|ALREADY|INVALID|MISMATCH|REQUIRED|NOT_ACTIONABLE|RELATION/i.test(
    message,
  );
}
