import axios from 'axios';
import { env } from '../config/env';

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
});
