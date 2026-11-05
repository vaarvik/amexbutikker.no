import type { z } from 'zod';
import type { JsonRequest } from './shared.model';

/** String storage that survives app restarts (AsyncStorage, SecureStore, localStorage). */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** The global `fetch`, injected so tests can replace it. */
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Sends JSON requests to the API and validates every response. */
export interface JsonTransport {
  /**
   * @returns the response body parsed with `schema`.
   * @throws ApiError when there is no response, the API answers with an error, or the body
   *   does not match `schema`.
   */
  request<T>(request: JsonRequest, schema: z.ZodType<T>): Promise<T>;
}

/** The part of expo-secure-store the app uses; the composition root passes the module itself. */
export interface SecureStoreModule {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/** The browser's `localStorage`: synchronous, strings only. */
export interface WebStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
