/** Statuses after which nothing else will happen on MONEI's side for this attempt. */
export const SUCCESS_STATUSES = new Set(["SUCCEEDED", "AUTHORIZED"]);
export const FAILURE_STATUSES = new Set(["FAILED", "CANCELED", "EXPIRED"]);

export type Outcome = "success" | "failure" | "pending";

export function outcomeOf(status: string | undefined): Outcome {
  if (!status) return "pending";
  if (SUCCESS_STATUSES.has(status)) return "success";
  if (FAILURE_STATUSES.has(status)) return "failure";
  return "pending";
}

export const RETURN_PARAM = "ctPaymentReference";

/** Adds the commercetools payment reference placeholder to the URL the shopper returns to after a redirect. */
export function buildReturnUrl(base: string, paymentReferencePlaceholder = "{paymentReference}"): string {
  const url = new URL(base);
  url.searchParams.set(RETURN_PARAM, paymentReferencePlaceholder);
  return url.toString();
}

/** Reads the payment reference back from the current URL after a redirect, if any. */
export function readReturnedPaymentReference(href: string): string | undefined {
  try {
    const value = new URL(href).searchParams.get(RETURN_PARAM);
    return value && !value.startsWith("{") ? value : undefined;
  } catch {
    return undefined;
  }
}
