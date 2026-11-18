import { afterEach, describe, expect, it } from "vitest";
import { requestSignal, setRequestSignal } from "./signal.js";

afterEach(() => setRequestSignal(null));

describe("requestSignal", () => {
  it("is not aborted by default", () => {
    expect(requestSignal().aborted).toBe(false);
  });

  it("follows the running task's signal", () => {
    const controller = new AbortController();
    setRequestSignal(controller.signal);
    const signal = requestSignal();
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(signal.aborted).toBe(true);
  });

  it("ignores a task that was cleared", () => {
    const controller = new AbortController();
    setRequestSignal(controller.signal);
    setRequestSignal(null);
    controller.abort();
    expect(requestSignal().aborted).toBe(false);
  });
});
