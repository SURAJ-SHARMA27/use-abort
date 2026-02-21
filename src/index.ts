import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Type for async functions that accept an AbortSignal
 */
export type AbortableAsyncFunction<TArgs extends any[], TData> = (
  signal: AbortSignal,
  ...args: TArgs
) => Promise<TData>;

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
}

/**
 * A React hook for safely handling async API calls with AbortController.
 *
 * Automatically:
 * - Aborts previous requests when a new one starts
 * - Aborts requests on component unmount
 * - Prevents stale responses from updating state
 * - Handles errors gracefully (ignoring abort errors)
 *
 * @param asyncFunction - An async function that accepts an AbortSignal as its first parameter
 * @returns Object containing run, cancel, data, error, and loading
 *
 * @example
 * ```tsx
 * const fetchUser = async (signal: AbortSignal, userId: string) => {
 *   const response = await fetch(`/api/users/${userId}`, { signal });
 *   return response.json();
 * };
 *
 * function UserProfile({ userId }: { userId: string }) {
 *   const { run, cancel, data, error, loading } = useAbort(fetchUser);
 *
 *   useEffect(() => {
 *     run(userId);
 *   }, [userId]);
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (data) return <div>{data.name}</div>;
 *   return null;
 * }
 * ```
 */
export function useAbort<TArgs extends any[], TData>(
  asyncFunction: AbortableAsyncFunction<TArgs, TData>,
): UseAbortReturn<TArgs, TData> {
  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Keep track of the current AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep track of the latest request ID to prevent stale updates
  const requestIdRef = useRef<number>(0);

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
   * Execute the async function with automatic abort handling
   */
  const run = useCallback(
    async (...args: TArgs): Promise<void> => {
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
    [asyncFunction, cancel],
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
  };
}
