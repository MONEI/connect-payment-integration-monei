import { describe, expect, test } from "@jest/globals";
import { buildReturnUrl, outcomeOf, readReturnedPaymentReference } from "../src/monei/outcome";

describe("outcome helpers", () => {
  test("maps MONEI statuses to Checkout outcomes", () => {
    expect(outcomeOf("SUCCEEDED")).toBe("success");
    expect(outcomeOf("AUTHORIZED")).toBe("success");
    expect(outcomeOf("FAILED")).toBe("failure");
    expect(outcomeOf("EXPIRED")).toBe("failure");
    expect(outcomeOf("CANCELED")).toBe("failure");
    expect(outcomeOf("PENDING")).toBe("pending");
    expect(outcomeOf(undefined)).toBe("pending");
  });

  test("return URL carries a placeholder the processor substitutes, and is read back after the redirect", () => {
    const url = buildReturnUrl("https://shop.example.com/checkout?step=payment");
    expect(url).toContain("ctPaymentReference=%7BpaymentReference%7D");
    expect(readReturnedPaymentReference(url)).toBeUndefined(); // unsubstituted placeholder is ignored
    expect(readReturnedPaymentReference("https://shop.example.com/checkout?step=payment&ctPaymentReference=abc-123")).toBe("abc-123");
    expect(readReturnedPaymentReference("not a url")).toBeUndefined();
  });
});
