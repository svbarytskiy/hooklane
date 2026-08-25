/// <reference types="jest" />

import type { SlackSendMessageStep } from "@hooklane/contracts";

jest.mock("@hooklane/db", () => ({
  createExecutionRepository: jest.fn(),
}));
import { ExpressionResolverService } from "./expression-resolver.service";
import { createExecutionRuntimeContext } from "./execution-runtime-context";
import { SlackSendMessageStepExecutor } from "./slack-send-message-step.executor";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const connectionId = "00000000-0000-4000-8000-000000000002";

function createStep(): SlackSendMessageStep {
  return {
    id: "notify-slack",
    type: "slack_send_message",
    name: "Notify Slack",
    config: {
      connectionId,
      channel: "C0123456789",
      text: "Order {{ event.payload.orderId }} completed",
    },
  };
}

function createExecutor(
  getAccessToken = jest.fn().mockResolvedValue("xoxb-test-token"),
) {
  const tokens = { getAccessToken };
  return {
    tokens,
    executor: new SlackSendMessageStepExecutor(
      tokens as never,
      new ExpressionResolverService(),
    ),
  };
}

describe("SlackSendMessageStepExecutor", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the workspace-owned connection and posts a resolved text message", async () => {
    const { tokens, executor } = createExecutor();
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ok: true, channel: "C0123456789", ts: "123.456" }),
          { status: 200 },
        ),
      );

    await expect(
      executor.execute(
        createStep(),
        createExecutionRuntimeContext(
          "execution-1",
          { orderId: "order-42" },
          workspaceId,
        ),
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      output: { channel: "C0123456789", messageTs: "123.456" },
      shouldContinue: true,
    });

    expect(tokens.getAccessToken).toHaveBeenCalledWith(
      workspaceId,
      connectionId,
      "notify-slack",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slack.com/api/chat.postMessage",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer xoxb-test-token",
        }),
        body: JSON.stringify({
          channel: "C0123456789",
          text: "Order order-42 completed",
        }),
      }),
    );
  });

  it("fails before the provider request when the connection is not active in the workspace", async () => {
    const { executor } = createExecutor(
      jest.fn().mockRejectedValue({
        code: "integration_connection_unavailable",
        retryable: false,
      }),
    );
    const fetchMock = jest.spyOn(globalThis, "fetch");

    await expect(
      executor.execute(
        createStep(),
        createExecutionRuntimeContext(
          "execution-1",
          { orderId: "order-42" },
          workspaceId,
        ),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      code: "integration_connection_unavailable",
      retryable: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("makes Slack rate limits retryable and preserves Retry-After", async () => {
    const { executor } = createExecutor();
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "ratelimited" }), {
        status: 429,
        headers: { "retry-after": "12" },
      }),
    );

    await expect(
      executor.execute(
        createStep(),
        createExecutionRuntimeContext(
          "execution-1",
          { orderId: "order-42" },
          workspaceId,
        ),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      code: "slack_rate_limited",
      category: "rate_limit",
      retryable: true,
      retryAfterMs: 12_000,
    });
  });

  it("does not retry a network failure because the message outcome is ambiguous", async () => {
    const { executor } = createExecutor();
    jest
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("socket closed"));

    await expect(
      executor.execute(
        createStep(),
        createExecutionRuntimeContext(
          "execution-1",
          { orderId: "order-42" },
          workspaceId,
        ),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      code: "slack_ambiguous_result",
      category: "ambiguous",
      retryable: false,
    });
  });
});
