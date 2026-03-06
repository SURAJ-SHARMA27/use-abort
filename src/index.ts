import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Type for async functions that accept an AbortSignal
 */
export type AbortableAsyncFunction<TArgs extends any[], TData> = (
  signal: AbortSignal,
  ...args: TArgs
) => Promise<TData>;

/**
 * Options for the useAbort hook
 */
export interface UseAbortOptions {
  /**
   * Enable caching of results.
   * - `true` → cache with default TTL of 30 seconds
   * - `number` → cache with custom TTL in milliseconds (e.g. 60000 = 1 minute)
   * - `false` or omitted → no caching (default)
   */
  cache?: boolean | number;
}

/**
 * Return type of the useAbort hook
 */
export interface UseAbortReturn<TArgs extends any[], TData> {
  /** Execute the async function with given arguments */
  run: (...args: TArgs) => Promise<void>;
  /** Cancel the currently running request */
  cancel: () => void;
  /** Data returned from the async function */
  data: TData | null;
  /** Error that occurred during execution (excluding abort errors) */
  error: Error | null;
  /** Whether a request is currently in progress */
  loading: boolean;
  /** Clear cached results. Pass args to clear a specific entry, or call with no args to clear all cache for this function */
  clearCache: (...args: TArgs | []) => void;
}

// ── Global cache store (shared across all components in the same tab) ──
const cacheStore = new Map<string, { data: unknown; timestamp: number }>();

const DEFAULT_CACHE_TTL = 30_000; // 30 seconds

function createCacheKey(fnId: string, args: unknown[]): string {
  try {
    return `${fnId}:${JSON.stringify(args)}`;
  } catch {
    return `${fnId}:${String(args)}`;
  }
}

function getCacheEntry<T>(key: string, ttl: number): T | undefined {
  const entry = cacheStore.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > ttl) {
    cacheStore.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function setCacheEntry<T>(key: string, data: T): void {
  cacheStore.set(key, { data, timestamp: Date.now() });
}

/**
 * A React hook for safely handling async API calls with AbortController.
 *
 * Automatically:
 * - Aborts previous requests when a new one starts
 * - Aborts requests on component unmount
 * - Prevents stale responses from updating state
 * - Handles errors gracefully (ignoring abort errors)
 * - Optionally caches results to avoid redundant network requests
 *
 * @param asyncFunction - An async function that accepts an AbortSignal as its first parameter
 * @param options - Optional configuration: `{ cache: true }` or `{ cache: 60000 }`
 * @returns Object containing run, cancel, data, error, loading, and clearCache
 *
 * @example
 * ```tsx
 * // Without cache (default)
 * const { run, data } = useAbort(fetchUser);
 *
 * // With cache (30s default TTL)
 * const { run, data } = useAbort(fetchUser, { cache: true });
 *
 * // With cache (custom 1 minute TTL)
 * const { run, data, clearCache } = useAbort(fetchUser, { cache: 60000 });
 * ```
 */
export function useAbort<TArgs extends any[], TData>(
  asyncFunction: AbortableAsyncFunction<TArgs, TData>,
  options?: UseAbortOptions,
): UseAbortReturn<TArgs, TData> {
  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Keep track of the current AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep track of the latest request ID to prevent stale updates
  const requestIdRef = useRef<number>(0);

  // Resolve cache settings
  const cacheEnabled = options?.cache !== undefined && options.cache !== false;
  const cacheTTL =
    typeof options?.cache === "number" ? options.cache : DEFAULT_CACHE_TTL;

  // Stable identifier for this async function (for cache keys)
  const fnIdRef = useRef<string>(
    asyncFunction.name || `useAbort_${Math.random().toString(36).slice(2)}`,
  );

  /**
   * Cancel the currently running request
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
    }
  }, []);

  /**
   * Clear cached results.
   * - Call with args to clear a specific cache entry
   * - Call with no args to clear all cache entries for this function
   */
  const clearCache = useCallback((...args: TArgs | []) => {
    if (args.length > 0) {
      // Clear specific entry
      const key = createCacheKey(fnIdRef.current, args);
      cacheStore.delete(key);
    } else {
      // Clear all entries for this function
      const prefix = `${fnIdRef.current}:`;
      for (const key of cacheStore.keys()) {
        if (key.startsWith(prefix)) {
          cacheStore.delete(key);
        }
      }
    }
  }, []);

  /**
   * Execute the async function with automatic abort handling
   */
  const run = useCallback(
    async (...args: TArgs): Promise<void> => {
      // ── Check cache first ──
      if (cacheEnabled) {
        const key = createCacheKey(fnIdRef.current, args);
        const cached = getCacheEntry<TData>(key, cacheTTL);
        if (cached !== undefined) {
          setData(cached);
          setError(null);
          setLoading(false);
          return;
        }
      }

      // Cancel any previous request
      cancel();

      // Create a new AbortController for this request
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Increment and capture the current request ID
      requestIdRef.current += 1;
      const currentRequestId = requestIdRef.current;

      // Reset error and set loading state
      setError(null);
      setLoading(true);

      try {
        // Execute the async function with the abort signal
        const result = await asyncFunction(controller.signal, ...args);

        // Only update state if this is still the latest request
        if (currentRequestId === requestIdRef.current) {
          // ── Store in cache ──
          if (cacheEnabled) {
            const key = createCacheKey(fnIdRef.current, args);
            setCacheEntry(key, result);
          }

          setData(result);
          setLoading(false);
        }
      } catch (err) {
        // Only update state if this is still the latest request
        if (currentRequestId === requestIdRef.current) {
          // Ignore abort errors
          if (err instanceof Error && err.name === "AbortError") {
            setLoading(false);
            return;
          }

          // Handle other errors
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    },
    [asyncFunction, cancel, cacheEnabled, cacheTTL],
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    run,
    cancel,
    data,
    error,
    loading,
    clearCache,
  };
}
