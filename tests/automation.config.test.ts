import { describe, expect, it } from "vitest";
import { AutomationConfigSchema } from "@/server/automation/types";
import { createDemoConfig } from "@/server/db/demo-data";

describe("automation config", () => {
  it("accepts the demo production defaults", () => {
    expect(() => AutomationConfigSchema.parse(createDemoConfig())).not.toThrow();
  });

  it("rejects invalid author emails", () => {
    const config = { ...createDemoConfig(), authorEmail: "not-an-email" };

    expect(() => AutomationConfigSchema.parse(config)).toThrow();
  });
});
