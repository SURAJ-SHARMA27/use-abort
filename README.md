<div align="center">

# use-abort

**Auto-cancel API calls. Cache responses. One hook.**

[![npm version](https://img.shields.io/npm/v/use-abort.svg?style=flat-square&color=646cff)](https://www.npmjs.com/package/use-abort)
[![bundle size](https://img.shields.io/bundlephobia/minzip/use-abort?style=flat-square&color=27ae60&label=size)](https://bundlephobia.com/package/use-abort)
[![license](https://img.shields.io/npm/l/use-abort?style=flat-square&color=888)](https://github.com/SURAJ-SHARMA27/use-abort/blob/main/LICENSE)

A tiny React hook that cancels stale API calls, prevents race conditions, and caches responses — with zero setup.

```bash
npm install use-abort
```

</div>

---

## NEW: Built-in Caching

Add `{ cache: true }` as a second param. That's it.

```tsx
// without cache — hits the network every time
const { run, data } = useAbort(fetchUser);

// with cache — repeat calls with same args return instantly
const { run, data } = useAbort(fetchUser, { cache: true });
```

Here's what happens under the hood:

```
run("react")  →  network request (800ms)  →  result cached for 30s
run("react")  →  cache hit, returns instantly (0ms)
run("vue")    →  different args, network request

// 30 seconds later...
run("react")  →  cache expired, fresh network request
```

Pass a number instead of `true` for a custom TTL:

```tsx
const { run, data, clearCache } = useAbort(fetchUser, { cache: 60000 }); // 1 minute

// after a mutation, clear stale data and re-fetch:
clearCache(userId);
run(userId);
```

> Cache is shared across components — fetch in a Sidebar, get instant data in a Profile. No providers, no context wrappers.

---

## The problem this solves

<table>
<tr>
<td width="50%">

**Without use-abort**

```tsx
// classic race condition
useEffect(() => {
  fetch(`/api/search?q=${query}`)
    .then((res) => res.json())
    .then((data) => setResults(data));
  // old slow response can overwrite
  // a newer fast response
}, [query]);
```

Type "react" (slow) then "vue" (fast)  
Vue loads first, then React overwrites it.  
**User sees wrong data.**

</td>
<td width="50%">

**With use-abort**

```tsx
const { run, data } = useAbort(searchAPI);

useEffect(() => {
  run(query);
  // previous request gets cancelled
  // only the latest response updates state
}, [query]);
```

Type "react" then "vue"  
React request gets cancelled.  
Vue loads. **Always correct.**

</td>
</tr>
</table>

---

## Quick Start

```tsx
import { useAbort } from "use-abort";

// 1. write your async function — takes signal as first arg
const fetchUser = async (signal: AbortSignal, id: number) => {
  const res = await fetch(`/api/users/${id}`, { signal });
  return res.json();
};

function UserProfile({ userId }: { userId: number }) {
  // 2. pass it to the hook (add cache if you want)
  const { run, data, loading, error } = useAbort(fetchUser, { cache: true });

  // 3. call run()
  useEffect(() => {
    run(userId);
  }, [userId]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  return <h1>{data?.name}</h1>;
}
```

Auto-cancel, caching, error handling, cleanup on unmount — all handled.

---

## Examples

### Search with debounce

```tsx
import { useAbort } from "use-abort";

const searchAPI = async (signal: AbortSignal, query: string) => {
  const res = await fetch(`/api/search?q=${query}`, { signal });
  return res.json();
};

function SearchBox() {
  const [query, setQuery] = useState("");
  const { run, cancel, data, loading } = useAbort(searchAPI);

  useEffect(() => {
    if (query.trim()) {
      const timer = setTimeout(() => run(query), 300);
      return () => clearTimeout(timer);
    }
  }, [query]);

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <button onClick={cancel} disabled={!loading}>
        Cancel
      </button>
      {loading && <p>Searching...</p>}
      {data?.map((item) => (
        <div key={item.id}>{item.title}</div>
      ))}
    </div>
  );
}
```

### Cache + invalidation after mutation

```tsx
const fetchUser = async (signal: AbortSignal, id: number) => {
  const res = await fetch(`/api/users/${id}`, { signal });
  return res.json();
};

function Profile({ userId }: { userId: number }) {
  const { run, data, loading, clearCache } = useAbort(fetchUser, {
    cache: true,
  });

  useEffect(() => {
    run(userId);
  }, [userId]);

  const handleUpdate = async (newName: string) => {
    await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: newName }),
    });
    clearCache(userId); // drop stale entry
    run(userId); // get fresh data
  };

  if (loading) return <p>Loading...</p>;
  return (
    <div>
      <h1>{data?.name}</h1>
      <button onClick={() => handleUpdate("New Name")}>Rename</button>
    </div>
  );
}
```

### With Axios

```tsx
import axios from "axios";
import { useAbort } from "use-abort";

const fetchOrders = async (signal: AbortSignal, userId: number) => {
  const { data } = await axios.get(`/api/orders`, {
    signal,
    params: { userId },
  });
  return data;
};

function Orders({ userId }: { userId: number }) {
  const { run, data, loading } = useAbort(fetchOrders, { cache: 15000 }); // 15s cache

  useEffect(() => {
    run(userId);
  }, [userId]);
  // ...
}
```

### With auth headers

```tsx
const fetchWithAuth = async (
  signal: AbortSignal,
  url: string,
  token: string,
) => {
  const res = await fetch(url, {
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
};

function ProtectedData({ token }: { token: string }) {
  const { run, data, loading } = useAbort(fetchWithAuth, { cache: true });

  useEffect(() => {
    run("/api/me", token);
  }, [token]);
  // ...
}
```

---

## API

### `useAbort(asyncFunction, options?)`

```tsx
const { run, cancel, data, error, loading, clearCache } = useAbort(
  myAsyncFn,
  options,
);
```

**Parameters**

| Param           | Type                                           | Description                                                    |
| --------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| `asyncFunction` | `(signal: AbortSignal, ...args) => Promise<T>` | Your async function. Signal is passed automatically.           |
| `options.cache` | `boolean \| number`                            | `true` = 30s cache. `number` = custom TTL in ms. Default: off. |

**Returns**

| Property     | Type                         | Description                                                                                     |
| ------------ | ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `run`        | `(...args) => Promise<void>` | Call your function. Cancels any previous in-flight request. Returns cached data when available. |
| `cancel`     | `() => void`                 | Manually cancel the current request.                                                            |
| `data`       | `T \| null`                  | Latest successful response.                                                                     |
| `error`      | `Error \| null`              | Latest error (abort errors are filtered out automatically).                                     |
| `loading`    | `boolean`                    | `true` while a request is in-flight.                                                            |
| `clearCache` | `(...args?) => void`         | Clear cache. Pass args for a specific entry, no args to clear everything.                       |

---

## How cache works

```
Component A                        Component B
    |                                   |
    |  run(42)                          |
    |------> Network -----> Cache <-----|  run(42) --> instant!
    |                    { user: 42 }   |
    |                                   |
    |  (30 seconds pass)                |
    |                                   |
    |  run(42)                          |
    |------> Network (cache expired)    |
```

- `run(1)` and `run(2)` are cached separately (per-argument)
- Cache is shared across all component instances
- Entries expire automatically after TTL
- Call `clearCache()` when you need fresh data
- No providers, no context — just works

---

## When to cache

| Scenario                | What to use                                                 |
| ----------------------- | ----------------------------------------------------------- |
| Search / typeahead      | `useAbort(fn)` — don't cache, abort is what matters         |
| User profile / settings | `useAbort(fn, { cache: true })` — data doesn't change often |
| Dashboard / analytics   | `useAbort(fn, { cache: 60000 })` — expensive queries        |
| After a POST/PUT/DELETE | `clearCache()` then `run()`                                 |
| Real-time data          | `useAbort(fn)` — skip cache, always fetch fresh             |

---

## Internals

- Each `run()` aborts the previous in-flight request using `AbortController`
- Request IDs prevent stale responses from updating state
- Pending requests are cancelled on component unmount
- `AbortError` is caught and ignored (it's intentional, not a bug)
- Cache is a global in-memory `Map` keyed by function name + serialized args

---

## Tips

Always pass the signal to your HTTP client — otherwise abort won't work:

```tsx
fetch(url, { signal }); // works
axios.get(url, { signal }); // works
fetch(url); // won't cancel
```

Clear cache after writes:

```tsx
await updateUser(userId, newData);
clearCache(userId);
run(userId);
```

If your async function captures component state, wrap it in `useCallback`:

```tsx
const fetchData = useCallback(
  async (signal: AbortSignal, id: string) => {
    /* ... */
  },
  [someDependency],
);
const { run } = useAbort(fetchData);
```

---

## Contributing

Contributions welcome. Feel free to open a PR.

## License

MIT — [Suraj Sharma](https://github.com/SURAJ-SHARMA27)
