import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { WorkerEnv } from "../config/env.schema";
import { WorkflowRuntimeError } from "./workflow-runtime.error";

@Injectable()
export class HttpRequestPolicyService {
  private readonly allowedHosts: string[];
  private readonly deniedHosts: string[];
  readonly maxRedirects: number;
  readonly maxResponseBytes: number;

  constructor(config: ConfigService<WorkerEnv, true>) {
    this.allowedHosts = this.readHostPatterns(
      config.get("WORKFLOW_HTTP_ALLOWED_HOSTS", { infer: true }),
    );
    this.deniedHosts = this.readHostPatterns(
      config.get("WORKFLOW_HTTP_DENIED_HOSTS", { infer: true }),
    );
    this.maxRedirects = config.get("WORKFLOW_HTTP_MAX_REDIRECTS", {
      infer: true,
    });
    this.maxResponseBytes = config.get("WORKFLOW_HTTP_MAX_RESPONSE_BYTES", {
      infer: true,
    });
  }

  async assertAllowed(url: URL): Promise<void> {
    if (!["http:", "https:"].includes(url.protocol)) {
      throw this.policyError("HTTP steps only support http and https URLs");
    }
    if (url.username || url.password) {
      throw this.policyError("HTTP step URLs must not contain credentials");
    }
    if (this.matchesAny(url.hostname, this.deniedHosts)) {
      throw this.policyError(`HTTP host ${url.hostname} is denied by policy`);
    }
    if (
      !this.allowedHosts.includes("*") &&
      !this.matchesAny(url.hostname, this.allowedHosts)
    ) {
      throw this.policyError(
        `HTTP host ${url.hostname} is not in the allowlist`,
      );
    }

    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = await lookup(url.hostname, { all: true, verbatim: true });
    } catch (error) {
      throw new WorkflowRuntimeError(
        {
          code: "http_dns_lookup_failed",
          category: "network",
          message: `HTTP host ${url.hostname} could not be resolved`,
        },
        { cause: error },
      );
    }
    if (addresses.length === 0) {
      throw new WorkflowRuntimeError({
        code: "http_dns_lookup_failed",
        category: "network",
        message: `HTTP host ${url.hostname} did not resolve to an address`,
      });
    }
    if (addresses.some(({ address }) => this.isPrivateAddress(address))) {
      throw this.policyError(
        `HTTP host ${url.hostname} resolves to a blocked address`,
      );
    }
  }

  assertResponseSize(response: Response): void {
    const contentLength = response.headers.get("content-length");
    if (
      contentLength &&
      Number.isFinite(Number(contentLength)) &&
      Number(contentLength) > this.maxResponseBytes
    ) {
      throw new WorkflowRuntimeError({
        code: "http_response_too_large",
        category: "validation",
        message: `HTTP response exceeds ${this.maxResponseBytes} byte limit`,
        retryable: false,
      });
    }
  }

  private policyError(message: string): WorkflowRuntimeError {
    return new WorkflowRuntimeError({
      code: "http_request_rejected",
      category: "validation",
      message,
      retryable: false,
    });
  }

  private readHostPatterns(value: string): string[] {
    return value
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
  }

  private matchesAny(host: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      if (pattern === host) return true;
      return pattern.startsWith("*.") && host.endsWith(pattern.slice(1));
    });
  }

  private isPrivateAddress(address: string): boolean {
    if (isIP(address) === 4) {
      const [first, second] = address.split(".").map(Number);
      return (
        first === 0 ||
        first === 10 ||
        (first === 100 && second >= 64 && second <= 127) ||
        first === 127 ||
        first === 169 ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        (first === 198 && second >= 18 && second <= 19) ||
        first >= 224
      );
    }

    const normalized = address.toLowerCase();
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.")
    );
  }
}
