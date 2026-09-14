import axios from 'axios';
import { handleMockRequest } from './mockBackend';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('careflow_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    // If backend is offline or network error occurs, fallback seamlessly to client-side data service
    const isNetworkError =
      error.code === 'ERR_NETWORK' ||
      error.message === 'Network Error' ||
      !error.response ||
      error.code === 'ECONNABORTED';

    if (isNetworkError && error.config) {
      try {
        const method = (error.config.method || 'get').toLowerCase();
        const url = error.config.url || '';
        const data = error.config.data;
        const params = error.config.params;
        const headers = error.config.headers;

        const mockData = handleMockRequest(method, url, data, params, headers);
        return Promise.resolve({
          data: mockData,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: error.config,
        });
      } catch (mockErr) {
        return Promise.reject(mockErr);
      }
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('careflow_token');
      localStorage.removeItem('careflow_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export function formatError(err, fallback = 'An unexpected error occurred.') {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || fallback;

  const cleanMsg = (raw) => {
    if (raw == null) return '';
    let msg = typeof raw === 'string' ? raw : raw.msg || raw.message || JSON.stringify(raw);
    if (typeof msg !== 'string') return fallback;

    // Strip internal Pydantic prefix: "Value error, "
    msg = msg.replace(/^Value error,\s*/i, '');

    // If it is a 30-minute boundary error, present it in clean patient-friendly language
    if (msg.includes('30-minute boundary') || msg.includes('scheduled_time')) {
      const nearestMatch = msg.match(/Nearest open slot[^.)]*(\([^)]*\))?/i);
      if (nearestMatch) {
        return `Appointments are scheduled in 30-minute intervals (on the hour or half-hour). ${nearestMatch[0]}.`;
      }
      return 'Appointments are scheduled in 30-minute intervals (on the hour or half-hour). Please select the nearest open slot.';
    }

    return msg;
  };

  if (typeof detail === 'string') return cleanMsg(detail);
  if (Array.isArray(detail)) {
    return detail.map(cleanMsg).filter(Boolean).join('; ');
  }
  if (typeof detail === 'object') {
    return cleanMsg(detail);
  }
  return fallback;
}

export default client;
