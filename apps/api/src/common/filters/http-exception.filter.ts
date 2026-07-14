import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { RequestWithId } from '../middleware/request-logging.middleware';

type ErrorResponseBody = {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string | string[];
  requestId: string;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithId>();

    const isHttpException = exception instanceof HttpException;

    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isHttpException
      ? this.getHttpExceptionMessage(exception)
      : 'Internal server error';

    const errorResponse: ErrorResponseBody = {
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      message,
      requestId: request.requestId,
    };

    this.logException(exception, request, statusCode);

    response.status(statusCode).json(errorResponse);
  }

  private getHttpExceptionMessage(exception: HttpException): string | string[] {
    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
    ) {
      const message = exceptionResponse.message;

      if (Array.isArray(message)) {
        return message.map(String);
      }

      if (typeof message === 'string') {
        return message;
      }
    }

    return exception.message;
  }

  private logException(
    exception: unknown,
    request: Request,
    statusCode: number,
  ): void {
    const requestContext = `${request.method} ${request.originalUrl}`;

    if (statusCode >= 500) {
      const error =
        exception instanceof Error ? exception.stack : String(exception);

      this.logger.error(`${requestContext} failed`, error);
      return;
    }

    this.logger.warn(`${requestContext} returned ${statusCode}`);
  }
}
