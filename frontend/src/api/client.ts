import axios from 'axios';
import type { ApiError } from './types';

const TOKEN_KEY = 'keystone_token';

// Backend root URL from environment. Defaults to empty (relative) so local dev
// via the Vite proxy works without configuration. In production set VITE_API_URL
// to your deployed backend, e.g. https://your-backend.vercel.app
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

// Always talk to the backend under the /api prefix (matching Express routes).
const apiBase = API_URL ? `${API_URL.replace(/\/+$/, '')}/api` : '/api';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export const api = axios.create({
  baseURL: apiBase,
  timeout: 15000, // 15 second timeout — prevents requests hanging forever
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Auto-logout on 401 (expired/invalid token) but only when a token exists
    // so login failures don't trigger a redirect loop
    if (error.response?.status === 401 && getToken()) {
      setToken(null);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export function errorMessage(err: unknown): string {
  const apiErr = err as {
    response?: { data?: ApiError; status?: number };
    code?: string;
    message?: string;
  };

  // Server responded with a structured error — prefer its message
  if (apiErr.response?.data?.message) {
    const fieldErrors = apiErr.response.data.fieldErrors;
    if (fieldErrors && Object.keys(fieldErrors).length > 0) {
      return Object.values(fieldErrors).join(', ');
    }
    return apiErr.response.data.message;
  }

  // Handle specific HTTP status codes with friendly messages
  switch (apiErr.response?.status) {
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 401:
      return 'Invalid username or password.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'A conflict occurred. The record may already exist.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Server error. Please try again in a moment.';
  }

  // Network / connection errors (no response at all)
  if (!apiErr.response) {
    if (
      apiErr.code === 'ECONNREFUSED' ||
      apiErr.code === 'ERR_NETWORK' ||
      apiErr.code === 'NETWORK_ERROR' ||
      apiErr.code === 'ERR_CONNECTION_REFUSED'
    ) {
      return 'Cannot reach the server. Please check your network connection and that the API is running.';
    }
    if (apiErr.code === 'ECONNABORTED' || apiErr.message?.includes('timeout')) {
      return 'Request timed out. The server is taking too long to respond — please try again.';
    }
  }

  if (apiErr instanceof Error) {
    return apiErr.message;
  }
  return 'An unexpected error occurred. Please try again.';
}
