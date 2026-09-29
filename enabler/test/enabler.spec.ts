import { describe, expect, jest, test } from "@jest/globals";
import { MoneiPaymentEnabler } from "../src/payment-enabler/payment-enabler-monei";
import { ProcessorClient } from "../src/monei/processor-client";
import type { MoneiSdk } from "../src/monei/types";
import { DropinType } from "../src/payment-enabler/payment-enabler";

const fakeMonei = {} as MoneiSdk;
const processorWith = (over: Partial<ProcessorClient> = {}) =>
  ({
    getConfig: jest.fn(async () => ({ clientKey: "acc_1", environment: "test" })),
    getPaymentStatus: jest.fn(async () => ({ paymentReference: "ct1", moneiPaymentId: "mp1", status: "SUCCEEDED" })),
    ...over,
  }) as unknown as ProcessorClient;

const make = (processor = processorWith(), onComplete = jest.fn(), onError = jest.fn()) =>
  new MoneiPaymentEnabler(
    { processorUrl: "https://p", sessionId: "s", onComplete, onError },
    { processor, loadMonei: async () => fakeMonei },
  );

describe("MoneiPaymentEnabler", () => {
  test("reads the account id and environment from the processor, never from the page", async () => {
    const enabler = make();
    const { baseOptions } = await enabler.setupData;
    expect(baseOptions.accountId).toBe("acc_1");
    expect(baseOptions.environment).toBe("test");
    expect(baseOptions.monei).toBe(fakeMonei);
  });

  test("exposes exactly the supported component builders", async () => {
    const enabler = make();
    for (const type of ["card", "bizum", "applePay", "googlePay"]) {
      await expect(enabler.createComponentBuilder(type)).resolves.toBeDefined();
    }
    await expect(enabler.createComponentBuilder("sepaDirectDebit")).rejects.toThrow(/not supported/);
    await expect(enabler.createDropinBuilder(DropinType.embedded)).resolves.toBeDefined();
    await expect(enabler.createDropinBuilder(DropinType.hpp)).rejects.toThrow(/not supported/);
    await expect(enabler.createStoredPaymentMethodBuilder("card")).rejects.toThrow(/not supported/);
    await expect(enabler.isStoredPaymentMethodsEnabled()).resolves.toBe(false);
  });

  test("wallets have no Checkout submit button; card and Bizum do", async () => {
    const enabler = make();
    expect((await enabler.createComponentBuilder("card")).componentHasSubmit).toBe(true);
    expect((await enabler.createComponentBuilder("bizum")).componentHasSubmit).toBe(true);
    expect((await enabler.createComponentBuilder("applePay")).componentHasSubmit).toBe(false);
    expect((await enabler.createComponentBuilder("googlePay")).componentHasSubmit).toBe(false);
  });

  describe("redirect return", () => {
    test("reports success once the processor confirms the payment", async () => {
      const onComplete = jest.fn();
      const processor = processorWith();
      const { baseOptions } = await make(processor, onComplete).setupData;
      await MoneiPaymentEnabler.handleRedirectReturn(baseOptions, "https://shop/checkout?ctPaymentReference=ct1");
      expect(processor.getPaymentStatus).toHaveBeenCalledWith("ct1");
      expect(onComplete).toHaveBeenCalledWith({ isSuccess: true, paymentReference: "ct1" });
    });

    test("reports failure for FAILED/EXPIRED and stays quiet while PENDING", async () => {
      const onComplete = jest.fn();
      const processor = processorWith({
        getPaymentStatus: jest.fn(async () => ({ paymentReference: "ct1", moneiPaymentId: "mp1", status: "EXPIRED" })),
      } as unknown as Partial<ProcessorClient>);
      const { baseOptions } = await make(processor, onComplete).setupData;
      await MoneiPaymentEnabler.handleRedirectReturn(baseOptions, "https://shop/x?ctPaymentReference=ct1");
      expect(onComplete).toHaveBeenCalledWith({ isSuccess: false, paymentReference: "ct1" });

      const pending = processorWith({
        getPaymentStatus: jest.fn(async () => ({ paymentReference: "ct1", moneiPaymentId: "mp1", status: "PENDING" })),
      } as unknown as Partial<ProcessorClient>);
      const quiet = jest.fn();
      const { baseOptions: b2 } = await make(pending, quiet).setupData;
      await MoneiPaymentEnabler.handleRedirectReturn(b2, "https://shop/x?ctPaymentReference=ct1");
      expect(quiet).not.toHaveBeenCalled();
    });

    test("does nothing when the URL has no payment reference", async () => {
      const processor = processorWith();
      const { baseOptions } = await make(processor).setupData;
      await MoneiPaymentEnabler.handleRedirectReturn(baseOptions, "https://shop/checkout");
      expect(processor.getPaymentStatus).not.toHaveBeenCalled();
    });

    test("routes processor errors to onError with the reference", async () => {
      const onError = jest.fn();
      const processor = processorWith({ getPaymentStatus: jest.fn(async () => { throw new Error("down"); }) } as unknown as Partial<ProcessorClient>);
      const { baseOptions } = await make(processor, jest.fn(), onError).setupData;
      await MoneiPaymentEnabler.handleRedirectReturn(baseOptions, "https://shop/x?ctPaymentReference=ct1");
      expect(onError).toHaveBeenCalledWith(expect.any(Error), { paymentReference: "ct1" });
    });
  });
});
