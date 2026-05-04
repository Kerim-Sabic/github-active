import { describe, expect, it } from "vitest";
import { getRunNowGate } from "@/server/automation/run-now-policy";

describe("run-now policy", () => {
  it("rejects unauthenticated real commit requests", () => {
    expect(getRunNowGate({ userId: null, databaseConfigured: true })).toMatchObject({
      allowed: false,
      status: 401
    });
  });

  it("rejects requests when the database is unavailable", () => {
    expect(getRunNowGate({ userId: "user-id", databaseConfigured: false })).toMatchObject({
      allowed: false,
      status: 503
    });
  });

  it("allows authenticated requests with database configured", () => {
    expect(getRunNowGate({ userId: "user-id", databaseConfigured: true })).toEqual({ allowed: true });
  });
});
