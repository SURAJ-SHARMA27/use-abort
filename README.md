# use-abort

React hook for auto-canceling async API calls with AbortController. Prevents race conditions, handles cleanup, and works with fetch/axios.

## Features

✅ **Automatic Cancellation** - Aborts previous requests when a new one starts  
✅ **Cleanup on Unmount** - Automatically cancels pending requests when component unmounts  
✅ **Stale Response Prevention** - Ensures only the latest request updates state  
✅ **Error Handling** - Gracefully handles errors while ignoring abort errors  
✅ **TypeScript First** - Full type safety with TypeScript generics  
✅ **Zero Dependencies** - Only requires React (peer dependency)  
✅ **Framework Agnostic** - Works with fetch, axios, or any async function

## Installation

```bash
npm install use-abort
```

## Quick Start

```tsx
import { useAbort } from "use-abort";

const fetchData = async (signal: AbortSignal, query: string) => {
  const res = await fetch(`/api/search?q=${query}`, { signal });
  return res.json();
};

function SearchComponent() {
  const { run, data, loading, error } = useAbort(fetchData);

  useEffect(() => {
    run(searchQuery);
  }, [searchQuery]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return <div>{data?.results}</div>;
}
```

That's it! Just 3 steps: define your async function, use the hook, call `run()`.

---

## The Problem

**Without `use-abort`, search inputs cause race conditions:**

```tsx
// ❌ BROKEN: Race condition - slower responses overwrite newer ones!
function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) return;

    setLoading(true);
    fetch(`/api/search?q=${query}`)
      .then((res) => res.json())
      .then((data) => {
        setResults(data); // ⚠️ Problem: Old request can overwrite new results!
        setLoading(false);
      });
  }, [query]);

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      {loading && <div>Loading...</div>}
      {results && <div>{results.length} results</div>}
    </div>
  );
}
```

**What goes wrong:**

1. User types "react" → Request A sent (takes 2000ms)
2. User types "vue" → Request B sent (takes 500ms)
3. Request B finishes first → Shows Vue results ✅
4. Request A finishes late → **Overwrites with React results** ❌

**Result:** UI shows wrong data! User typed "vue" but sees "react" results.

---

## The Solution

**With `use-abort`, requests are automatically cancelled:**

```tsx
// ✅ FIXED: Previous requests auto-cancelled, no race conditions!
import { useAbort } from "use-abort";

const searchAPI = async (signal: AbortSignal, query: string) => {
  const res = await fetch(`/api/search?q=${query}`, { signal });
  return res.json();
};

function SearchBox() {
  const [query, setQuery] = useState("");
  const { run, data, loading } = useAbort(searchAPI);

  useEffect(() => {
    if (query) run(query); // Auto-cancels previous request!
  }, [query]);

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      {loading && <div>Loading...</div>}
      {data && <div>{data.length} results</div>}
    </div>
  );
}
```

**What happens now:**

1. User types "react" → Request A sent
2. User types "vue" → **Request A cancelled** → Request B sent
3. Request B finishes → Shows Vue results ✅
4. Request A already cancelled → Doesn't update anything ✅

**Result:** UI always shows correct data! 🎉

---

## More Examples

### Debounced Search with Manual Cancel

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