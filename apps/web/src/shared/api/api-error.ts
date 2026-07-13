import { AxiosError } from 'axios';

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const detail = error.response?.data;

    if (typeof detail === 'object' && detail !== null && 'message' in detail) {
      const message = detail.message;
      return Array.isArray(message) ? message.join(', ') : String(message);
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected API error';
}
