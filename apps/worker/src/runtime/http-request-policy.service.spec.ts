/// <reference types="jest" />

import { ConfigService } from "@nestjs/config";
import { HttpRequestPolicyService } from "./http-request-policy.service";

function createPolicy(overrides: Record<string, unknown> = {}) {
  return new HttpRequestPolicyService(
    new ConfigService({
      WORKFLOW_HTTP_ALLOWED_HOSTS: "api.example.com,*.trusted.test",
      WORKFLOW_HTTP_DENIED_HOSTS: "localhost,*.local",
      WORKFLOW_HTTP_MAX_REDIRECTS: 0,
      WORKFLOW_HTTP_MAX_RESPONSE_BYTES: 10,
      ...overrides,
    }) as never,
  );
}

describe("HttpRequestPolicyService", () => {
  it("rejects denied and non-allowlisted hosts before DNS resolution", async () => {
    const policy = createPolicy();

    await expect(
      policy.assertAllowed(new URL("http://localhost:3000/internal")),
    ).rejects.toThrow("denied by policy");
    await expect(
      policy.assertAllowed(new URL("https://untrusted.example.com")),
    ).rejects.toThrow("not in the allowlist");
  });

  it("enforces response byte limits from content-length", () => {
    const policy = createPolicy();

    expect(() =>
      policy.assertResponseSize(
        new Response("too long", { headers: { "content-length": "11" } }),
      ),
    ).toThrow("10 byte limit");
  });
});
