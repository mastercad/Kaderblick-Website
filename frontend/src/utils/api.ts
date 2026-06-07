import { BACKEND_URL } from '../../config';

// Hilfsfunktion: JWT aus Cookie extrahieren
function getJwtFromCookie(cookieName = 'jwt'): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  cache?: RequestCache;
}

/**
 * Zentrale API-Funktion die automatisch Cookies mitschickt
 * und korrekte Headers setzt
 */
export async function apiRequest(endpoint: string, options: ApiRequestOptions = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    cache,
  } = options;

  // JWT aus Cookie holen und als Authorization-Header setzen
  const jwt = getJwtFromCookie();
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const config: RequestInit = {
    method,
    credentials: 'include', // Immer Cookies mitschicken
    ...(cache !== undefined ? { cache } : {}),
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(jwt ? { 'Authorization': `Bearer ${jwt}` } : {}),
      ...headers
    }
  };

  if (body && method !== 'GET') {
    config.body = isFormData ? body : JSON.stringify(body);
  }

  const url = `${BACKEND_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const response = await fetch(url, config);
  
  // Bei 401 könnte das Token abgelaufen sein
  if (response.status === 401) {
    // Hier könnte man einen Event dispatchen um den User automatisch auszuloggen
    console.warn('API request returned 401 - user might need to login again');
  }
  
  return response;
}

/**
 * API Error class for structured error handling
 */
export class ApiError extends Error {
  public status?: number;
  public data?: any;
  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function isAuthenticationError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/**
 * Vereinfachte API-Funktion die direkt JSON zurückgibt.
 * Wirft ApiError bei HTTP-Fehlern.
 */
export async function apiJson<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await apiRequest(endpoint, options);

  // 204 No Content: Symfony lässt den Body leer – JSON-Parse würde werfen
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError('Unknown error', response.status);
  }
  if (!response.ok) {
    const errorMsg = typeof data === 'object' && data?.error
      ? data.error
      : (data?.message || `HTTP ${response.status}`);
    throw new ApiError(errorMsg, response.status, data);
  }
  return data as T;
}

/**
 * Gives a user-friendly German error message for an API error.
 * Maps HTTP status codes to clean messages; falls back to the server message.
 */
export function getApiErrorMessage(error: unknown, fallback = 'Ein unbekannter Fehler ist aufgetreten.'): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Sie haben keine Berechtigung für diese Aktion.';
    if (error.status === 404) return 'Der Eintrag wurde nicht gefunden.';
    if (error.status !== undefined && error.status >= 500) return 'Ein Serverfehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
    return error.message || fallback;
  }
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

/**
 * API-Funktion die eine Blob-Antwort (z.B. PDF) zurückgibt.
 * Wirft ApiError bei HTTP-Fehlern.
 */
export async function apiBlob(endpoint: string, options: ApiRequestOptions = {}): Promise<Blob> {
  const response = await apiRequest(endpoint, options);
  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      msg = data?.error || data?.message || msg;
    } catch {
      // ignore
    }
    throw new ApiError(msg, response.status);
  }
  return response.blob();
}
