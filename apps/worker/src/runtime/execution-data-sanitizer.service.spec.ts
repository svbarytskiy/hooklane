/// <reference types="jest" />

import { ConfigService } from "@nestjs/config";
import { ExecutionDataSanitizerService } from "./execution-data-sanitizer.service";

describe("ExecutionDataSanitizerService", () => {
  it("redacts secrets from durable input and output snapshots", () => {
    const sanitizer = new ExecutionDataSanitizerService(
      new ConfigService({ WORKFLOW_REDACT_KEYS: "customer_key" }) as never,
    );

    expect(
      sanitizer.stepInput({
        id: "request",
        name: "Request",
        type: "http_request",
        config: {
          url: "https://api.example.com",
          method: "POST",
          headers: { Authorization: "Bearer secret", "x-trace-id": "safe" },
          body: { customer_key: "hidden", amount: 42 },
        },
      }),
    ).toEqual({
      type: "http_request",
      config: {
        url: "https://api.example.com",
        method: "POST",
        headers: { Authorization: "[REDACTED]", "x-trace-id": "safe" },
        body: { customer_key: "[REDACTED]", amount: 42 },
      },
    });
  });
});
