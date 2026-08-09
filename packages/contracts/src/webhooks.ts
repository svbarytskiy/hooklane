export type WebhookEndpointStatus = "active" | "inactive";

export type WebhookSignatureMode = "none" | "hmac_sha256";

export type IncomingEventStatus = "accepted";

export type ExecutionStatus =
  "pending" | "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type WebhookEndpointSummary = {
  id: string;
  workflowId: string;
  name: string;
  publicId: string;
  url: string;
  status: WebhookEndpointStatus;
  signatureMode: WebhookSignatureMode;
  secretLastRotatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IncomingEventReceipt = {
  eventId: string;
  executionId: string;
  status: "accepted";
};

export type CreateWebhookEndpointRequest = {
  name: string;
  signatureMode?: "hmac_sha256" | "none";
};

export type CreateWebhookEndpointResponse = {
  endpoint: WebhookEndpointSummary;
  signingSecret: string | null;
};

export type UpdateWebhookEndpointRequest = {
  status: WebhookEndpointStatus;
};

export type RotateWebhookEndpointSecretResponse = {
  endpoint: WebhookEndpointSummary;
  signingSecret: string;
};
