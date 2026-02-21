# use-abort

A lightweight, production-ready React hook for safely handling async API calls with automatic request cancellation using `AbortController`.

## Features

✅ **Automatic Cancellation** - Aborts previous requests when a new one starts  
✅ **Cleanup on Unmount** - Automatically cancels pending requests when component unmounts  
✅ **Stale Response Prevention** - Ensures only the latest request updates state  
✅ **Error Handling** - Gracefully handles errors while ignoring abort errors  
✅ **TypeScript First** - Full type safety with TypeScript generics  
✅ **Zero Dependencies** - Only requires React (peer dependency)  
✅ **Framework Agnostic** - Works with any async function (fetch, axios, etc.)

## Installation

```bash
npm install use-abort
```

```bash
yarn add use-abort
```

```bash
pnpm add use-abort
```

## Usage

### Basic Example

```tsx
import { useAbort } from "use-abort";

// Define your async function (must accept AbortSignal as first parameter)
const fetchUser = async (signal: AbortSignal, userId: string) => {
  const response = await fetch(`/api/users/${userId}`, { signal });
  if (!response.ok) throw new Error("Failed to fetch user");
  return response.json();
};

function UserProfile({ userId }: { userId: string }) {
  const { run, cancel, data, error, loading } = useAbort(fetchUser);

  useEffect(() => {
    run(userId);
  }, [userId, run]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (data) return <div>User: {data.name}</div>;
  return null;
}
```

### Search with Auto-Cancel Example

```tsx
import { useAbort } from "use-abort";
import { useState, useEffect } from "react";

const searchAPI = async (signal: AbortSignal, query: string) => {
  const response = await fetch(`/api/search?q=${query}`, { signal });
  return response.json();
};

function SearchBox() {
  const [query, setQuery] = useState("");
  const { run, cancel, data, error, loading } = useAbort(searchAPI);

  // Debounced search with automatic cancellation
  useEffect(() => {
    if (query.trim()) {
      const timer = setTimeout(() => run(query), 300);
      return () => clearTimeout(timer);
    }
  }, [query, run]);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />
      <button onClick={cancel} disabled={!loading}>
        Cancel
      </button>
      {loading && <div>Searching...</div>}
      {error && <div>Error: {error.message}</div>}
      {data && <div>Results: {data.results.length}</div>}
    </div>
  );
}
```

### With Axios

```tsx
import axios from "axios";
import { useAbort } from "use-abort";

const fetchData = async (signal: AbortSignal, endpoint: string) => {
  const { data } = await axios.get(endpoint, { signal });
  return data;
};

function DataFetcher() {
  const { run, data, error, loading } = useAbort(fetchData);

  useEffect(() => {
    run("/api/data");
  }, [run]);

  // Component rendering...
}
```

### With Custom Headers

```tsx
const fetchWithAuth = async (
  signal: AbortSignal,
  url: string,
  token: string,
) => {
  const response = await fetch(url, {
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return response.json();
};

function ProtectedData({ token }: { token: string }) {
  const { run, data, error, loading } = useAbort(fetchWithAuth);

  useEffect(() => {
    run("/api/protected", token);
  }, [token, run]);

  // Component rendering...
}
```

## API

### `useAbort<TArgs, TData>(asyncFunction)`

#### Parameters

- **`asyncFunction`**: `(signal: AbortSignal, ...args: TArgs) => Promise<TData>`
  - An async function that accepts an `AbortSignal` as its first parameter
  - Can accept any number of additional arguments
  - Must return a Promise

#### Returns

An object with the following properties:

- **`run`**: `(...args: TArgs) => Promise<void>`
  - Executes the async function with the provided arguments
  - Automatically cancels any previous pending request
  - Passes an `AbortSignal` as the first argument

- **`cancel`**: `() => void`
  - Manually cancels the currently running request
  - Safe to call even if no request is running

- **`data`**: `TData | null`
  - The data returned from the most recent successful request
  - `null` if no request has completed successfully yet

- **`error`**: `Error | null`
  - The error from the most recent failed request
  - `null` if no error has occurred or request is in progress
  - Abort errors are automatically filtered out

- **`loading`**: `boolean`
  - `true` when a request is in progress
  - `false` otherwise

## TypeScript Support

The hook is fully typed and provides excellent type inference:

```tsx
// Type inference works automatically
const fetchUser = async (signal: AbortSignal, id: number) => {
  const response = await fetch(`/api/users/${id}`, { signal });
  return response.json() as Promise<User>;
};

// TypeScript knows that:
// - run() expects a number argument
// - data is User | null
const { run, data } = useAbort(fetchUser);

run(123); // ✅ Correct
run("123"); // ❌ Type error
```

## How It Works

1. **Automatic Abort**: When `run()` is called, any previous request is automatically aborted before starting the new one
2. **Unmount Cleanup**: The hook automatically aborts pending requests when the component unmounts
3. **Stale Response Prevention**: Uses request IDs to ensure only the latest request can update state
4. **Error Filtering**: Automatically filters out `AbortError` to avoid showing errors for intentionally cancelled requests

## Best Practices

1. **Always pass AbortSignal to your API calls**:

   ```tsx
   fetch(url, { signal }); // ✅ Good
   fetch(url); // ❌ Won't be cancellable
   ```

2. **Memoize the async function if needed**:

   ```tsx
   const fetchData = useCallback(
     async (signal: AbortSignal, id: string) => {
       // ...
     },
     [dependency],
   );
   const { run } = useAbort(fetchData);
   ```

3. **Handle errors appropriately**:
   ```tsx
   if (error) {
     // Show user-friendly error message
     return <ErrorMessage error={error} />;
   }
   ```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
