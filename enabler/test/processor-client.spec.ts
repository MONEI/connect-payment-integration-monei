import { describe, expect, jest, test } from "@jest/globals";
import { ProcessorClient, ProcessorError } from "../src/monei/processor-client";

const mockFetch = (status: number, body: unknown) =>
  jest.fn(async () => ({ ok: status < 400, status, text: async () => JSON.stringify(body) })) as unknown as typeof fetch;

describe("ProcessorClient", () => {
  test("sends the Checkout session id on every request and parses JSON", async () => {
    const fetchFn = mockFetch(200, { clientKey: "acc_1", environment: "test" });
    const client = new ProcessorClient("https://processor.example.com/", "sess_1", fetchFn);
    await expect(client.getConfig()).resolves.toEqual({ clientKey: "acc_1", environment: "test" });
    const [url, init] = (fetchFn as jest.Mock).mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://processor.example.com/operations/config");
    expect((init.headers as Record<string, string>)["X-Session-Id"]).toBe("sess_1");
  });

  test("posts the payment request body as JSON", async () => {
    const fetchFn = mockFetch(200, { paymentReference: "ct1", moneiPaymentId: "mp1", status: "PENDING", redirectUrl: "https://r" });
    const client = new ProcessorClient("https://p", "s", fetchFn);
    const res = await client.createPayment({ paymentMethod: { type: "bizum" }, returnUrl: "https://shop/return" });
    expect(res.redirectUrl).toBe("https://r");
    const [, init] = (fetchFn as jest.Mock).mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ paymentMethod: { type: "bizum" }, returnUrl: "https://shop/return" });
  });

  test("throws a ProcessorError with the server message on non-2xx", async () => {
    const client = new ProcessorClient("https://p", "s", mockFetch(400, { message: "paymentMethod.type invalid" }));
    await expect(client.createPayment({ paymentMethod: { type: "card" } })).rejects.toThrow(ProcessorError);
    await expect(client.createPayment({ paymentMethod: { type: "card" } })).rejects.toThrow("paymentMethod.type invalid");
  });

  test("never sends card data: request shape only carries the MONEI.js token", async () => {
    const fetchFn = mockFetch(200, { paymentReference: "ct1", moneiPaymentId: "mp1", status: "SUCCEEDED" });
    const client = new ProcessorClient("https://p", "s", fetchFn);
    await client.createPayment({ paymentMethod: { type: "card", paymentToken: "tok", sessionId: "s" } });
    const [, init] = (fetchFn as jest.Mock).mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body as string).not.toMatch(/cardNumber|cvc|expiry/i);
  });
});
