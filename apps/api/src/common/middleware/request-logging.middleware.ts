import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithId = Request & {
  requestId: string;
};

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  use(request: RequestWithId, response: Response, next: NextFunction): void {
    const requestId = randomUUID();
    const startedAt = performance.now();

    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);

    response.on('finish', () => {
      const durationMs = Math.round(performance.now() - startedAt);

      const logEntry = {
        timestamp: new Date().toISOString(),
        level: response.statusCode >= 500 ? 'error' : 'info',
        event: 'http.request',
        requestId,
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        durationMs,
        userAgent: request.get('user-agent') ?? null,
      };

      console.log(JSON.stringify(logEntry));
    });

    next();
  }
}
