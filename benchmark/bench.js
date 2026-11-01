'use strict';

/*
 * Router-only micro-benchmark.
 *
 * It measures ONE thing: how long a router takes to turn (method, path) into
 * a handler, once the routes are registered. There is no HTTP server, no
 * socket and no handler execution. Read README.md before quoting any number.
 *
 * Usage:
 *   node bench.js            full run (several minutes)
 *   node bench.js --quick    short run for a smoke test (numbers are noisy)
 *   node bench.js --check    correctness checks only, no timing
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const args = new Set(process.argv.slice(2));
const QUICK = args.has('--quick');
const CHECK_ONLY = args.has('--check');

const TARGET_MS = QUICK ? 15 : 60;
const ROUNDS = QUICK ? 3 : 5;

// ---------------------------------------------------------------------------
// Libraries
// ---------------------------------------------------------------------------

const FindMyWay = require('find-my-way');
const Router = require('router');
const { RegExpRouter } = require('hono/router/reg-exp-router');
const { TrieRouter } = require('hono/router/trie-router');
const { LinearRouter } = require('hono/router/linear-router');
const { PatternRouter } = require('hono/router/pattern-router');
const { SmartRouter } = require('hono/router/smart-router');
const SegmentTrie = require('./lib/segment-trie.js').Router;

// Express 5 uses the `router` package, which depends on its own copy of
// path-to-regexp. Load that exact copy so the Express-style adapter is faithful.
const routerDir = path.dirname(require.resolve('router'));
const pathToRegexpPath = require.resolve('path-to-regexp', { paths: [routerDir] });
const pathToRegexp = require(pathToRegexpPath);

function pkgVersion(name, fromDir) {
  const main = require.resolve(name, fromDir ? { paths: [fromDir] } : undefined);
  let dir = path.dirname(main);

  // Walk up to the package.json that belongs to this package. Some packages
  // have nested package.json files without a name (for example dist/cjs).
  while (dir !== path.dirname(dir)) {
    const file = path.join(dir, 'package.json');

    if (fs.existsSync(file)) {
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));

      if (pkg.name === name) {
        return pkg.version;
      }
    }

    dir = path.dirname(dir);
  }

  throw new Error(`Could not find package.json for ${name}`);
}

const VERSIONS = {
  node: process.version,
  v8: process.versions.v8,
  'find-my-way': pkgVersion('find-my-way'),
  hono: pkgVersion('hono'),
  router: pkgVersion('router'),
  'path-to-regexp (used by router)': pkgVersion('path-to-regexp', routerDir),
};

// ---------------------------------------------------------------------------
// Scenarios
//
// A scenario is a route table plus the requests to send to it.
//   routes:   [{ method, pattern }]   registered in this order
//   requests: [{ name, method, path, expectedIndex, expectedParams, timed }]
//             expectedIndex is the index of the route that must answer, or null
//   mixed:    optional list of requests (length 16) that are rotated through
// ---------------------------------------------------------------------------

function sameRoute(method, pattern, routes) {
  for (let i = 0; i < routes.length; i++) {
    if (routes[i].method === method && routes[i].pattern === pattern) {
      return i;
    }
  }

  throw new Error(`No route ${method} ${pattern}`);
}

function simpleScenario(kind, count) {
  const routes = [];

  for (let i = 0; i < count; i++) {
    routes.push({ method: 'GET', pattern: kind === 'static' ? `/route${i}` : `/route${i}/:id` });
  }

  const pathFor = (i) => (kind === 'static' ? `/route${i}` : `/route${i}/42`);
  const params = kind === 'static' ? {} : { id: '42' };
  const middle = Math.floor(count / 2);

  const requests = [
    { name: 'first', method: 'GET', path: pathFor(0), expectedIndex: 0, expectedParams: params, timed: true },
    { name: 'middle', method: 'GET', path: pathFor(middle), expectedIndex: middle, expectedParams: params, timed: true },
    { name: 'last', method: 'GET', path: pathFor(count - 1), expectedIndex: count - 1, expectedParams: params, timed: true },
    { name: 'miss', method: 'GET', path: kind === 'static' ? '/missing' : '/missing/42', expectedIndex: null, expectedParams: {}, timed: true },
    // Checked for correctness only: a known path with the wrong method.
    { name: 'wrong method', method: 'POST', path: pathFor(0), expectedIndex: null, expectedParams: {}, timed: false },
  ];

  return { kind, size: count, label: `${kind} routes, ${count} registered`, routes, requests, mixed: null };
}

// A REST-style API: shared prefixes, mixed methods, nested resources.
// Per resource: 7 routes. Two extra routes at the start.
function apiScenario(resourceCount) {
  const routes = [
    { method: 'GET', pattern: '/health' },
    { method: 'POST', pattern: '/login' },
  ];

  for (let r = 0; r < resourceCount; r++) {
    routes.push({ method: 'GET', pattern: `/res${r}` });
    routes.push({ method: 'POST', pattern: `/res${r}` });
    routes.push({ method: 'GET', pattern: `/res${r}/:id` });
    routes.push({ method: 'PUT', pattern: `/res${r}/:id` });
    routes.push({ method: 'DELETE', pattern: `/res${r}/:id` });
    routes.push({ method: 'GET', pattern: `/res${r}/:id/items` });
    routes.push({ method: 'POST', pattern: `/res${r}/:id/items` });
  }

  const middle = Math.floor(resourceCount / 2);
  const last = resourceCount - 1;

  const hit = (name, method, pathText, pattern, params, timed) => ({
    name,
    method,
    path: pathText,
    expectedIndex: sameRoute(method, pattern, routes),
    expectedParams: params,
    timed,
  });

  const requests = [
    hit('health', 'GET', '/health', '/health', {}, true),
    hit('get item (middle)', 'GET', `/res${middle}/42`, `/res${middle}/:id`, { id: '42' }, true),
    hit('delete item (middle)', 'DELETE', `/res${middle}/42`, `/res${middle}/:id`, { id: '42' }, true),
    hit('nested (last)', 'GET', `/res${last}/42/items`, `/res${last}/:id/items`, { id: '42' }, true),
    { name: 'miss', method: 'GET', path: '/nope/42/x', expectedIndex: null, expectedParams: {}, timed: true },
    { name: 'wrong method', method: 'PATCH', path: `/res${middle}/42`, expectedIndex: null, expectedParams: {}, timed: true },
  ];

  // Sixteen requests spread over the resources, rotated in a fixed order.
  const mixed = [];
  const templates = [
    ['GET', '/res{r}/{id}', '/res{r}/:id'],
    ['GET', '/res{r}', '/res{r}'],
    ['POST', '/res{r}', '/res{r}'],
    ['GET', '/res{r}/{id}', '/res{r}/:id'],
    ['PUT', '/res{r}/{id}', '/res{r}/:id'],
    ['DELETE', '/res{r}/{id}', '/res{r}/:id'],
    ['GET', '/res{r}/{id}/items', '/res{r}/:id/items'],
    ['POST', '/res{r}/{id}/items', '/res{r}/:id/items'],
    ['GET', '/health', '/health'],
    ['GET', '/res{r}/{id}', '/res{r}/:id'],
    ['POST', '/login', '/login'],
    ['GET', '/res{r}/{id}', '/res{r}/:id'],
    ['GET', '/nope/1/x', null],
    ['PATCH', '/res{r}/{id}', null],
    ['GET', '/res{r}/{id}/items', '/res{r}/:id/items'],
    ['GET', '/res{r}', '/res{r}'],
  ];

  for (let k = 0; k < templates.length; k++) {
    const r = (k * 7 + 3) % resourceCount;
    const id = String(40 + k);
    const [method, pathTemplate, patternTemplate] = templates[k];
    const fill = (text) => text.replace('{r}', String(r)).replace('{id}', id).replace(':id', ':id');
    const pathText = fill(pathTemplate);
    const hasId = pathTemplate.includes('{id}');

    if (patternTemplate === null) {
      mixed.push({ name: `mixed ${k}`, method, path: pathText, expectedIndex: null, expectedParams: {}, timed: false });
    } else {
      const pattern = patternTemplate.replace('{r}', String(r));
      mixed.push({
        name: `mixed ${k}`,
        method,
        path: pathText,
        expectedIndex: sameRoute(method, pattern, routes),
        expectedParams: hasId ? { id } : {},
        timed: false,
      });
    }
  }

  return {
    kind: 'api',
    size: routes.length,
    label: `REST-style API, ${routes.length} routes (${resourceCount} resources)`,
    routes,
    requests,
    mixed,
  };
}

const SCENARIOS = [
  simpleScenario('static', 10),
  simpleScenario('static', 100),
  simpleScenario('static', 1000),
  simpleScenario('param', 10),
  simpleScenario('param', 100),
  simpleScenario('param', 1000),
  apiScenario(7),
  apiScenario(70),
];

// ---------------------------------------------------------------------------
// Helpers shared by the adapters
// ---------------------------------------------------------------------------

// Every adapter registers the SAME handler functions, so results can be checked.
function makeHandlers(count) {
  const handlers = [];

  for (let i = 0; i < count; i++) {
    const handler = function handler() {};
    handler.id = i;
    handlers.push(handler);
  }

  return handlers;
}

const EMPTY = Object.freeze({});

function splitPath(pathname) {
  return pathname.split('/').filter(Boolean);
}

function plainExtract(result) {
  if (!result) {
    return { id: null, params: EMPTY };
  }

  return { id: result.handler.id, params: result.params };
}

function handlerOnlyExtract(result) {
  return result ? { id: result.id, params: EMPTY } : { id: null, params: EMPTY };
}

// ---------------------------------------------------------------------------
// Adapters
//
// build(routes, handlers) returns { match, extract, info? }
//   match(method, path, key)  the call that is timed, returning the router's
//                             native result
//   extract(result)           turns that native result into { id, params } so
//                             it can be checked. It is never timed.
//   info()                    optional note recorded in the results
// ---------------------------------------------------------------------------

const adapters = [];

// 1. A chain of if statements, generated as source code (section 4).
adapters.push({
  name: 'if/else chain',
  supports: ['static', 'param', 'api'],
  build(routes, handlers) {
    const hasParams = routes.some((route) => route.pattern.includes(':'));
    const lines = [];

    for (let i = 0; i < routes.length; i++) {
      const { method, pattern } = routes[i];

      if (!pattern.includes(':')) {
        lines.push(`  if (method === '${method}' && path === '${pattern}') {\n    return { handler: handlers[${i}], params: EMPTY };\n  }`);
        continue;
      }

      const segments = splitPath(pattern);
      const conditions = [`method === '${method}'`, `parts.length === ${segments.length + 1}`];
      const paramEntries = [];

      for (let k = 0; k < segments.length; k++) {
        if (segments[k].startsWith(':')) {
          paramEntries.push(`${segments[k].slice(1)}: parts[${k + 1}]`);
        } else {
          conditions.push(`parts[${k + 1}] === '${segments[k]}'`);
        }
      }

      lines.push(`  if (${conditions.join(' && ')}) {\n    return { handler: handlers[${i}], params: { ${paramEntries.join(', ')} } };\n  }`);
    }

    const prelude = hasParams ? "  const parts = path.split('/');\n" : '';
    const body = `${prelude}${lines.join('\n')}\n  return null;`;
    const match = new Function('handlers', 'EMPTY', `return function match(method, path) {\n${body}\n};`)(handlers, EMPTY);

    return { match, extract: plainExtract };
  },
});

// 2. A switch on the path (section 4). Static GET routes only.
adapters.push({
  name: 'switch (static only)',
  supports: ['static'],
  build(routes, handlers) {
    const cases = [];

    for (let i = 0; i < routes.length; i++) {
      cases.push(`    case '${routes[i].pattern}':\n      if (method === 'GET') {\n        return handlers[${i}];\n      }\n      break;`);
    }

    const body = `  switch (path) {\n${cases.join('\n')}\n  }\n  return null;`;
    const match = new Function('handlers', `return function match(method, path) {\n${body}\n};`)(handlers);

    return { match, extract: handlerOnlyExtract };
  },
});

// 3. A Map keyed by "METHOD path" (section 5). Static GET routes only.
adapters.push({
  name: 'Map, key built per request (static only)',
  supports: ['static'],
  build(routes, handlers) {
    const map = new Map();

    for (let i = 0; i < routes.length; i++) {
      map.set(`${routes[i].method} ${routes[i].pattern}`, handlers[i]);
    }

    return {
      match(method, pathname) {
        return map.get(method + ' ' + pathname);
      },
      extract: handlerOnlyExtract,
    };
  },
});

// 3b. Diagnostic: same Map, but the key string already exists, so the timing
// shows the cost of the lookup alone, without the string concatenation. It
// reuses one string object per request, which flatters the lookup, so read it
// as a floor.
adapters.push({
  name: 'Map, key precomputed (diagnostic, static only)',
  supports: ['static'],
  build(routes, handlers) {
    const map = new Map();

    for (let i = 0; i < routes.length; i++) {
      map.set(`${routes[i].method} ${routes[i].pattern}`, handlers[i]);
    }

    return {
      match(method, pathname, key) {
        return map.get(key);
      },
      extract: handlerOnlyExtract,
    };
  },
});

// 4. Split the path into segments and scan a list (section 6).
function matchSegments(patternSegments, pathSegments) {
  const params = {};

  for (let i = 0; i < patternSegments.length; i++) {
    const pattern = patternSegments[i];

    if (pattern === '*') {
      params.wildcard = pathSegments.slice(i).join('/');
      return params;
    }

    if (i >= pathSegments.length) {
      return null;
    }

    if (pattern.startsWith(':')) {
      params[pattern.slice(1)] = pathSegments[i];
    } else if (pattern !== pathSegments[i]) {
      return null;
    }
  }

  return patternSegments.length === pathSegments.length ? params : null;
}

adapters.push({
  name: 'Segment split + list scan',
  supports: ['static', 'param', 'api'],
  build(routes, handlers) {
    const list = routes.map((route, i) => ({ method: route.method, segments: splitPath(route.pattern), handler: handlers[i] }));

    return {
      match(method, pathname) {
        const pathSegments = splitPath(pathname);

        for (let i = 0; i < list.length; i++) {
          const route = list[i];

          if (route.method !== method) {
            continue;
          }

          const params = matchSegments(route.segments, pathSegments);

          if (params) {
            return { handler: route.handler, params };
          }
        }

        return null;
      },
      extract: plainExtract,
    };
  },
});

// 5. An ordered list of compiled patterns, tried one by one (section 7's idea),
// using the same path-to-regexp copy that Express 5 uses.
adapters.push({
  name: 'Ordered list of path-to-regexp matchers',
  supports: ['static', 'param', 'api'],
  build(routes, handlers) {
    const list = routes.map((route, i) => ({
      method: route.method,
      matcher: pathToRegexp.match(route.pattern, { decode: decodeURIComponent }),
      handler: handlers[i],
    }));

    return {
      match(method, pathname) {
        for (let i = 0; i < list.length; i++) {
          const route = list[i];
          const result = route.matcher(pathname);

          if (result && route.method === method) {
            return { handler: route.handler, params: result.params };
          }
        }

        return null;
      },
      extract: plainExtract,
    };
  },
});

// 6. The real Express 5 layer stack, scanned the way the router's own loop does:
// layer.match(path), then route._handlesMethod(method). This reaches into the
// `router` package's internals (stack, match, _handlesMethod) because the public
// API only runs a whole request. It leaves out request handling on purpose.
adapters.push({
  name: 'Express 5 router: layer scan (internals)',
  supports: ['static', 'param', 'api'],
  build(routes, handlers) {
    const router = new Router();

    for (let i = 0; i < routes.length; i++) {
      router[routes[i].method.toLowerCase()](routes[i].pattern, handlers[i]);
    }

    const stack = router.stack;

    return {
      match(method, pathname) {
        for (let i = 0; i < stack.length; i++) {
          const layer = stack[i];

          if (layer.match(pathname) && layer.route._handlesMethod(method)) {
            return layer;
          }
        }

        return null;
      },
      extract(layer) {
        if (!layer) {
          return { id: null, params: EMPTY };
        }

        return { id: layer.route.stack[0].handle.id, params: layer.params };
      },
    };
  },
});

// 7. find-my-way, the router inside Fastify (section 9).
adapters.push({
  name: 'find-my-way (Fastify)',
  supports: ['static', 'param', 'api'],
  build(routes, handlers) {
    const router = FindMyWay();

    for (let i = 0; i < routes.length; i++) {
      router.on(routes[i].method, routes[i].pattern, handlers[i]);
    }

    return {
      match(method, pathname) {
        return router.find(method, pathname);
      },
      extract: plainExtract,
    };
  },
});

// 8. Hono's routers used directly (section 10).
function honoAdapter(name, createRouter) {
  return {
    name,
    supports: ['static', 'param', 'api'],
    build(routes, handlers) {
      const router = createRouter();

      for (let i = 0; i < routes.length; i++) {
        router.add(routes[i].method, routes[i].pattern, handlers[i]);
      }

      return {
        match(method, pathname) {
          return router.match(method, pathname);
        },
        extract(result) {
          const entry = result[0][0];

          if (!entry) {
            return { id: null, params: EMPTY };
          }

          const params = {};
          const stash = result[1];

          // RegExpRouter returns an index into a stash instead of the value.
          for (const key of Object.keys(entry[1])) {
            const value = entry[1][key];
            params[key] = typeof value === 'number' ? stash[value] : value;
          }

          return { id: entry[0].id, params };
        },
        // SmartRouter renames itself after it has chosen a router.
        info() {
          return router.name;
        },
      };
    },
  };
}

adapters.push(honoAdapter('Hono RegExpRouter', () => new RegExpRouter()));
adapters.push(honoAdapter('Hono TrieRouter', () => new TrieRouter()));
adapters.push(honoAdapter('Hono SmartRouter (RegExp, Trie)', () => new SmartRouter({ routers: [new RegExpRouter(), new TrieRouter()] })));
adapters.push(honoAdapter('Hono LinearRouter', () => new LinearRouter()));
adapters.push(honoAdapter('Hono PatternRouter', () => new PatternRouter()));

// 9. The segment trie from section 8.
adapters.push({
  name: 'Segment trie (section 8)',
  supports: ['static', 'param', 'api'],
  build(routes, handlers) {
    const router = new SegmentTrie();

    for (let i = 0; i < routes.length; i++) {
      router.add(routes[i].method, routes[i].pattern, handlers[i]);
    }

    return {
      match(method, pathname) {
        return router.find(method, pathname);
      },
      extract: plainExtract,
    };
  },
});

// ---------------------------------------------------------------------------
// Correctness checks (run before any timing)
// ---------------------------------------------------------------------------

function sameParams(actual, expected) {
  const a = Object.keys(actual || {}).sort();
  const e = Object.keys(expected).sort();

  if (a.length !== e.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== e[i] || actual[a[i]] !== expected[e[i]]) {
      return false;
    }
  }

  return true;
}

function keyOf(request) {
  return request.method + ' ' + request.path;
}

function verify(instance, scenario) {
  const problems = [];

  for (const request of [...scenario.requests, ...(scenario.mixed || [])]) {
    const result = instance.match(request.method, request.path, keyOf(request));
    const { id, params } = instance.extract(result);

    if (id !== request.expectedIndex) {
      problems.push(`${request.name}: expected handler ${request.expectedIndex}, got ${id}`);
      continue;
    }

    if (!sameParams(params, request.expectedParams)) {
      problems.push(`${request.name}: expected params ${JSON.stringify(request.expectedParams)}, got ${JSON.stringify(params)}`);
    }
  }

  return problems;
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

const now = () => Number(process.hrtime.bigint());

// A fresh function for every measurement keeps each adapter's call site
// separate, so one adapter's types do not slow down the next. The loop rotates
// through the request arrays (length 1 for a single request, 16 for the mix).
function makeLoop() {
  return new Function(
    'match',
    'methods',
    'paths',
    'keys',
    'mask',
    'iterations',
    'let sink;\nfor (let i = 0; i < iterations; i++) {\n  const j = i & mask;\n  sink = match(methods[j], paths[j], keys[j]);\n}\nreturn sink;'
  );
}

function measure(match, requests) {
  const loop = makeLoop();
  const methods = requests.map((r) => r.method);
  const paths = requests.map((r) => r.path);
  const keys = requests.map(keyOf);
  const mask = requests.length - 1;

  const run = (iterations) => {
    const start = now();
    loop(match, methods, paths, keys, mask, iterations);
    return now() - start;
  };

  // Find an iteration count that takes about TARGET_MS.
  let iterations = 128;
  let elapsed = run(iterations);

  while (elapsed < TARGET_MS * 1e6 / 4) {
    iterations *= 2;
    elapsed = run(iterations);
  }

  iterations = Math.max(128, Math.round(iterations * (TARGET_MS * 1e6) / elapsed));

  // Warm up so the engine has optimized the loop, then measure.
  for (let i = 0; i < 3; i++) {
    run(iterations);
  }

  const samples = [];

  for (let i = 0; i < ROUNDS; i++) {
    samples.push(run(iterations) / iterations);
  }

  samples.sort((a, b) => a - b);

  return {
    median: samples[Math.floor(samples.length / 2)],
    min: samples[0],
    max: samples[samples.length - 1],
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function measureSetup(adapter, scenario) {
  const handlers = makeHandlers(scenario.routes.length);
  const request = scenario.requests[0];
  const times = [];

  for (let i = 0; i < 5; i++) {
    const start = now();
    const instance = adapter.build(scenario.routes, handlers);
    // Some routers (Hono's RegExpRouter and SmartRouter) finish building on
    // the first match, so include it.
    instance.match(request.method, request.path, keyOf(request));
    times.push((now() - start) / 1e6);
  }

  return median(times);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function formatNs(value) {
  if (value >= 1000) {
    return value.toFixed(0);
  }

  if (value >= 100) {
    return value.toFixed(1);
  }

  return value.toFixed(2);
}

function timedColumns(scenario) {
  const columns = scenario.requests.filter((r) => r.timed).map((r) => ({ name: r.name, requests: [r] }));

  if (scenario.mixed) {
    columns.push({ name: 'mixed (16 rotating)', requests: scenario.mixed });
  }

  return columns;
}

function main() {
  console.log('Router-only benchmark');
  console.log(JSON.stringify(VERSIONS, null, 2));
  console.log(`mode: ${CHECK_ONLY ? 'check only' : QUICK ? 'quick (noisy)' : 'full'}\n`);

  // 1. Correctness
  let failures = 0;

  for (const scenario of SCENARIOS) {
    const handlers = makeHandlers(scenario.routes.length);

    for (const adapter of adapters) {
      if (!adapter.supports.includes(scenario.kind)) {
        continue;
      }

      let problems;

      try {
        const instance = adapter.build(scenario.routes, handlers);
        problems = verify(instance, scenario);
      } catch (error) {
        problems = [`threw ${error.constructor.name}: ${error.message}`];
      }

      if (problems.length > 0) {
        failures++;
        console.log(`FAIL  ${adapter.name} [${scenario.label}]`);

        for (const problem of problems) {
          console.log(`        ${problem}`);
        }
      }
    }
  }

  if (failures > 0) {
    console.log(`\n${failures} correctness check(s) failed. No timing was done.`);
    process.exit(1);
  }

  console.log('All correctness checks passed (every router returns the right handler and params).\n');

  if (CHECK_ONLY) {
    return;
  }

  // 2. Timing
  const results = [];

  for (const scenario of SCENARIOS) {
    const handlers = makeHandlers(scenario.routes.length);
    const columns = timedColumns(scenario);

    console.log(`== ${scenario.label}`);

    for (const adapter of adapters) {
      if (!adapter.supports.includes(scenario.kind)) {
        continue;
      }

      const instance = adapter.build(scenario.routes, handlers);
      const cells = {};

      for (const column of columns) {
        cells[column.name] = measure(instance.match, column.requests);
      }

      const note = instance.info ? instance.info() : null;

      results.push({ scenario: scenario.label, kind: scenario.kind, routes: scenario.routes.length, adapter: adapter.name, note, ns: cells });

      process.stdout.write(
        `${adapter.name.padEnd(48)}` +
          columns.map((c) => `${c.name}=${formatNs(cells[c.name].median)}`.padEnd(28)).join('') +
          (note && note !== adapter.name ? ` [${note}]` : '') +
          '\n'
      );
    }

    console.log('');
  }

  // 3. Setup time
  const setup = [];
  const setupScenarios = [SCENARIOS.find((s) => s.kind === 'static' && s.size === 1000), SCENARIOS.find((s) => s.kind === 'param' && s.size === 1000), SCENARIOS[SCENARIOS.length - 1]];

  for (const scenario of setupScenarios) {
    for (const adapter of adapters) {
      if (!adapter.supports.includes(scenario.kind)) {
        continue;
      }

      setup.push({ scenario: scenario.label, adapter: adapter.name, ms: measureSetup(adapter, scenario) });
    }
  }

  writeOutputs(results, setup, setupScenarios);
}

function writeOutputs(results, setup, setupScenarios) {
  const environment = {
    versions: VERSIONS,
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0] ? os.cpus()[0].model.trim() : 'unknown',
    cpuCount: os.cpus().length,
    totalMemoryGB: Math.round(os.totalmem() / 1e9),
    mode: QUICK ? 'quick' : 'full',
    targetMsPerRound: TARGET_MS,
    rounds: ROUNDS,
    date: new Date().toISOString(),
  };

  fs.writeFileSync('results.json', JSON.stringify({ environment, results, setup }, null, 2));

  const lines = [];
  lines.push('# Router-only benchmark results', '');
  lines.push('Median nanoseconds per match (lower is better). Router only: no HTTP, no handler execution.', '');
  lines.push('## Environment', '');

  for (const [key, value] of Object.entries(environment.versions)) {
    lines.push(`- ${key}: ${value}`);
  }

  lines.push(`- platform: ${environment.platform}`);
  lines.push(`- cpu: ${environment.cpu} (${environment.cpuCount} logical cores)`);
  lines.push(`- memory: ${environment.totalMemoryGB} GB`);
  lines.push(`- mode: ${environment.mode} (${environment.rounds} rounds of about ${environment.targetMsPerRound} ms)`);
  lines.push(`- date: ${environment.date}`, '');

  for (const scenario of SCENARIOS) {
    const columns = timedColumns(scenario);
    lines.push(`## ${scenario.label}`, '');
    lines.push(`| Router | ${columns.map((c) => c.name).join(' | ')} |`);
    lines.push(`|---|${columns.map(() => '---:').join('|')}|`);

    for (const row of results.filter((r) => r.scenario === scenario.label)) {
      lines.push(`| ${row.adapter} | ${columns.map((c) => formatNs(row.ns[c.name].median)).join(' | ')} |`);
    }

    const smart = results.find((r) => r.scenario === scenario.label && r.adapter.startsWith('Hono SmartRouter'));

    if (smart && smart.note) {
      lines.push('', `SmartRouter settled on: ${smart.note}`);
    }

    lines.push('');
  }

  lines.push('## Setup time (register all routes, then the first match), milliseconds', '');
  lines.push(`| Router | ${setupScenarios.map((s) => s.label).join(' | ')} |`);
  lines.push(`|---|${setupScenarios.map(() => '---:').join('|')}|`);

  for (const adapter of adapters) {
    const cells = setupScenarios.map((s) => {
      const row = setup.find((x) => x.scenario === s.label && x.adapter === adapter.name);
      return row ? row.ms.toFixed(2) : 'n/a';
    });

    lines.push(`| ${adapter.name} | ${cells.join(' | ')} |`);
  }

  // Cells whose five rounds disagreed by more than 10% of the median.
  const noisy = [];

  for (const row of results) {
    for (const [name, cell] of Object.entries(row.ns)) {
      const spread = (cell.max - cell.min) / cell.median;

      if (spread > 0.1) {
        noisy.push({ row, name, cell, spread });
      }
    }
  }

  lines.push('', '## Noisy cells (min to max range above 10% of the median)', '');

  if (noisy.length === 0) {
    lines.push('None.');
  } else {
    lines.push('| Scenario | Router | Request | min | median | max |');
    lines.push('|---|---|---|---:|---:|---:|');

    for (const item of noisy.sort((a, b) => b.spread - a.spread)) {
      lines.push(`| ${item.row.scenario} | ${item.row.adapter} | ${item.name} | ${formatNs(item.cell.min)} | ${formatNs(item.cell.median)} | ${formatNs(item.cell.max)} |`);
    }
  }

  lines.push('');
  fs.writeFileSync('results.md', lines.join('\n'));

  console.log('Wrote results.md and results.json');
}

main();
