# Router-only benchmark

Companion script for the article on routing algorithms in Node.js. It measures one thing: how long a router takes to turn `(method, path)` into a handler once the routes are registered.

## Run it

Requires **Node.js 26.13.0** (the latest LTS when this was written; see `.nvmrc`). Other versions will run, but your numbers will not be comparable with the article's.

```bash
npm ci            # installs the exact versions in package-lock.json
npm run check     # correctness only: every router must return the right handler and params
npm run bench     # full run, several minutes
```

`npm run quick` does a ~30 second smoke test. Its numbers are noisy, so don't quote them.

The run writes two files: `results.md` (tables) and `results.json` (everything, including min and max per cell).

## For stable numbers

- Close browsers, editors and anything else busy. Plug in a laptop.
- Run it two or three times. If a cell changes a lot between runs, trust the pattern, not the digits.
- Always report the Node version, the CPU, and the package versions (they are written to `results.md`).

## What is measured

Routes are registered once. Then, for each router, the script times the match call in a tight loop for four requests: the **first** registered route, the **middle** one, the **last** one, and a path that matches **nothing**. It does this for 10, 100 and 1000 routes, in two scenarios:

- **static**: `/route0`, `/route1`, ... (request `/route500`)
- **param**: `/route0/:id`, `/route1/:id`, ... (request `/route500/42`)

Each cell is the median of several rounds, in nanoseconds per match. Before any timing, the script checks that every router returns the correct handler and parameters for all four requests and that `POST` on a `GET` route does not match.

At the end, it also reports setup time: registering 1000 routes plus the first match.

## The routers

| Name | What it is |
|---|---|
| if/else chain | Generated source code, one `if` per route (article section 4). Param routes split the path once. |
| switch (static only) | Generated `switch` on the path, then a method check. |
| Map, key built per request | `Map.get(method + ' ' + path)` (section 5). Static only. |
| Map, key precomputed | Diagnostic only: the key string already exists, to separate the lookup from the string concatenation. |
| Segment split + list scan | Section 6. Splits the path, then tries each route in order. |
| Ordered list of path-to-regexp matchers | One compiled matcher per route, tried in order, using the same `path-to-regexp` copy Express 5 uses. |
| Express 5 router: layer scan | The real `router` package's layer stack, scanned the way its own loop does (`layer.match`, then `route._handlesMethod`). |
| find-my-way | The router inside Fastify (section 9). |
| Hono RegExpRouter / TrieRouter / SmartRouter / LinearRouter / PatternRouter | Hono's five routers, used directly (section 10). |
| Segment trie | The section 8 sketch. |

## Read this before quoting a number

- **Router only.** No HTTP server, no sockets, no parsing, no handler execution, no middleware. A real request costs far more than any number here. This benchmark says nothing about end-to-end throughput.
- **The Express adapter reaches into internals** (`stack`, `match`, `_handlesMethod`), because the public API only runs a whole request. It excludes request handling, `next()` bookkeeping and parameter processing, so it understates what Express does per request.
- **Hono's routers are used directly,** not through the `Hono` app object. `SmartRouter` picks its router on the first match; the warm-up covers that.
- **Each cell repeats one request.** That is friendly to the CPU's branch predictor and caches. Real traffic mixes paths.
- **Very large generated functions** (the if/else chain and switch at 1000 routes) may not be optimized the same way as small ones. The script does not investigate why; treat those cells as "what this code does on this engine".
- **Different machines give different absolute numbers.** Compare routers with each other within one run, not against numbers from someone else's machine.
- A fast router is only one concern. The article's checklist (conflict rules, 404 vs 405, slashes, case) usually matters more.
