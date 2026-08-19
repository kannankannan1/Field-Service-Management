import axios from 'axios';
import type { ApiError } from './types';

const TOKEN_KEY = 'keystone_token';

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
  baseURL: (import.meta.env.VITE_API_URL || '') + '/api',
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
  const apiErr = err as { response?: { data?: ApiError; status?: number }; code?: string; message?: string };
  if (apiErr.response?.data?.message) {
    const fieldErrors = apiErr.response.data.fieldErrors;
    if (fieldErrors && Object.keys(fieldErrors).length > 0) {
      return Object.values(fieldErrors).join(', ');
    }
    return apiErr.response.data.message;
  }
  if (apiErr.response?.status === 401) {
    return 'Invalid username or password';
  }
  if (!apiErr.response && (apiErr.code === 'ECONNREFUSED' || apiErr.code === 'ERR_NETWORK' || apiErr.message?.includes('500'))) {
    return 'Backend server is not running. Start it with: cd backend && .\\mvnw.cmd spring-boot:run';
  }
  if (apiErr instanceof Error) {
    return apiErr.message;
  }
  return 'Unexpected error';
}
