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
const ROUTE_COUNTS = [10, 100, 1000];
const TARGETS = ['first', 'middle', 'last', 'miss'];
const SCENARIOS = ['static', 'param'];

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
// Test data
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

function patternFor(scenario, i) {
  return scenario === 'static' ? `/route${i}` : `/route${i}/:id`;
}

function requestPathFor(scenario, i) {
  return scenario === 'static' ? `/route${i}` : `/route${i}/42`;
}

function missPathFor(scenario) {
  return scenario === 'static' ? '/missing' : '/missing/42';
}

function indexFor(target, count) {
  if (target === 'first') {
    return 0;
  }

  if (target === 'middle') {
    return Math.floor(count / 2);
  }

  return count - 1;
}

// ---------------------------------------------------------------------------
// Adapters
//
// build(scenario, count, handlers) returns { match, extract }
//   match(method, path, key)  the call that is timed, returning the router's
//                             native result
//   extract(result)           turns that native result into { id, params } so
//                             it can be checked. It is never timed.
// ---------------------------------------------------------------------------

const EMPTY = Object.freeze({});

function plainExtract(result) {
  if (!result) {
    return { id: null, params: EMPTY };
  }

  return { id: result.handler.id, params: result.params };
}

const adapters = [];

// 1. A chain of if statements, generated as source code (section 4).
adapters.push({
  name: 'if/else chain',
  supports: ['static', 'param'],
  build(scenario, count, handlers) {
    const lines = [];

    for (let i = 0; i < count; i++) {
      if (scenario === 'static') {
        lines.push(`  if (method === 'GET' && path === '/route${i}') {\n    return { handler: handlers[${i}], params: EMPTY };\n  }`);
      } else {
        lines.push(`  if (method === 'GET' && parts.length === 3 && parts[1] === 'route${i}') {\n    return { handler: handlers[${i}], params: { id: parts[2] } };\n  }`);
      }
    }

    const prelude = scenario === 'static' ? '' : "  const parts = path.split('/');\n";
    const body = `${prelude}${lines.join('\n')}\n  return null;`;
    const match = new Function('handlers', 'EMPTY', `return function match(method, path) {\n${body}\n};`)(handlers, EMPTY);

    return { match, extract: plainExtract };
  },
});

// 2. A switch on the path (section 4). Static routes only.
adapters.push({
  name: 'switch (static only)',
  supports: ['static'],
  build(scenario, count, handlers) {
    const cases = [];

    for (let i = 0; i < count; i++) {
      cases.push(`    case '/route${i}':\n      if (method === 'GET') {\n        return handlers[${i}];\n      }\n      break;`);
    }

    const body = `  switch (path) {\n${cases.join('\n')}\n  }\n  return null;`;
    const match = new Function('handlers', `return function match(method, path) {\n${body}\n};`)(handlers);

    return {
      match,
      extract(result) {
        return result ? { id: result.id, params: EMPTY } : { id: null, params: EMPTY };
      },
    };
  },
});

// 3. A Map keyed by "METHOD path" (section 5). Static routes only.
adapters.push({
  name: 'Map, key built per request (static only)',
  supports: ['static'],
  build(scenario, count, handlers) {
    const map = new Map();

    for (let i = 0; i < count; i++) {
      map.set(`GET ${patternFor('static', i)}`, handlers[i]);
    }

    return {
      match(method, path) {
        return map.get(method + ' ' + path);
      },
      extract(result) {
        return result ? { id: result.id, params: EMPTY } : { id: null, params: EMPTY };
      },
    };
  },
});

// 3b. Diagnostic: same Map, but the key string already exists, so the timing
// shows the cost of the lookup alone, without the string concatenation.
adapters.push({
  name: 'Map, key precomputed (diagnostic, static only)',
  supports: ['static'],
  build(scenario, count, handlers) {
    const map = new Map();

    for (let i = 0; i < count; i++) {
      map.set(`GET ${patternFor('static', i)}`, handlers[i]);
    }

    return {
      match(method, path, key) {
        return map.get(key);
      },
      extract(result) {
        return result ? { id: result.id, params: EMPTY } : { id: null, params: EMPTY };
      },
    };
  },
});

// 4. Split the path into segments and scan a list (section 6).
function splitPath(pathname) {
  return pathname.split('/').filter(Boolean);
}

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
  supports: ['static', 'param'],
  build(scenario, count, handlers) {
    const routes = [];

    for (let i = 0; i < count; i++) {
      routes.push({ method: 'GET', segments: splitPath(patternFor(scenario, i)), handler: handlers[i] });
    }

    return {
      match(method, pathname) {
        const pathSegments = splitPath(pathname);

        for (let i = 0; i < routes.length; i++) {
          const route = routes[i];

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
  supports: ['static', 'param'],
  build(scenario, count, handlers) {
    const routes = [];

    for (let i = 0; i < count; i++) {
      routes.push({
        method: 'GET',
        matcher: pathToRegexp.match(patternFor(scenario, i), { decode: decodeURIComponent }),
        handler: handlers[i],
      });
    }

    return {
      match(method, pathname) {
        for (let i = 0; i < routes.length; i++) {
          const route = routes[i];
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
  supports: ['static', 'param'],
  build(scenario, count, handlers) {
    const router = new Router();

    for (let i = 0; i < count; i++) {
      router.get(patternFor(scenario, i), handlers[i]);
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
  supports: ['static', 'param'],
  build(scenario, count, handlers) {
    const router = FindMyWay();

    for (let i = 0; i < count; i++) {
      router.on('GET', patternFor(scenario, i), handlers[i]);
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
    supports: ['static', 'param'],
    build(scenario, count, handlers) {
      const router = createRouter();

      for (let i = 0; i < count; i++) {
        router.add('GET', patternFor(scenario, i), handlers[i]);
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
  supports: ['static', 'param'],
  build(scenario, count, handlers) {
    const router = new SegmentTrie();

    for (let i = 0; i < count; i++) {
      router.add('GET', patternFor(scenario, i), handlers[i]);
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

function requestFor(scenario, count, target) {
  if (target === 'miss') {
    return { method: 'GET', path: missPathFor(scenario), expectedId: null };
  }

  const index = indexFor(target, count);

  return { method: 'GET', path: requestPathFor(scenario, index), expectedId: index };
}

function verify(adapter, instance, scenario, count) {
  const problems = [];

  for (const target of TARGETS) {
    const request = requestFor(scenario, count, target);
    const key = request.method + ' ' + request.path;
    const result = instance.match(request.method, request.path, key);
    const { id, params } = instance.extract(result);

    if (id !== request.expectedId) {
      problems.push(`${target}: expected handler ${request.expectedId}, got ${id}`);
      continue;
    }

    const expectedParams = request.expectedId !== null && scenario === 'param' ? { id: '42' } : {};

    if (!sameParams(params, expectedParams)) {
      problems.push(`${target}: expected params ${JSON.stringify(expectedParams)}, got ${JSON.stringify(params)}`);
    }
  }

  // A known path with the wrong method must not match.
  const wrong = requestFor(scenario, count, 'first');
  const wrongResult = instance.match('POST', wrong.path, 'POST ' + wrong.path);
  const wrongExtracted = instance.extract(wrongResult);

  if (wrongExtracted.id !== null) {
    problems.push('wrong method: expected no match');
  }

  return problems;
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

const now = () => Number(process.hrtime.bigint());

// A fresh function for every measurement keeps each adapter's call site
// separate, so one adapter's types do not slow down the next.
function makeLoop() {
  return new Function(
    'match',
    'method',
    'path',
    'key',
    'iterations',
    'let sink;\nfor (let i = 0; i < iterations; i++) {\n  sink = match(method, path, key);\n}\nreturn sink;'
  );
}

function measure(match, request) {
  const loop = makeLoop();
  const key = request.method + ' ' + request.path;
  const run = (iterations) => {
    const start = now();
    loop(match, request.method, request.path, key, iterations);
    return now() - start;
  };

  // Find an iteration count that takes about TARGET_MS.
  let iterations = 100;
  let elapsed = run(iterations);

  while (elapsed < TARGET_MS * 1e6 / 4) {
    iterations *= 2;
    elapsed = run(iterations);
  }

  iterations = Math.max(100, Math.round(iterations * (TARGET_MS * 1e6) / elapsed));

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

function measureSetup(adapter, scenario, count) {
  const handlers = makeHandlers(count);
  const request = requestFor(scenario, count, 'first');
  const times = [];

  for (let i = 0; i < 5; i++) {
    const start = now();
    const instance = adapter.build(scenario, count, handlers);
    // Some routers (Hono's RegExpRouter and SmartRouter) finish building on
    // the first match, so include it.
    instance.match(request.method, request.path, request.method + ' ' + request.path);
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

function main() {
  console.log('Router-only benchmark');
  console.log(JSON.stringify(VERSIONS, null, 2));
  console.log(`mode: ${CHECK_ONLY ? 'check only' : QUICK ? 'quick (noisy)' : 'full'}\n`);

  // 1. Correctness
  let failures = 0;

  for (const scenario of SCENARIOS) {
    for (const count of ROUTE_COUNTS) {
      const handlers = makeHandlers(count);

      for (const adapter of adapters) {
        if (!adapter.supports.includes(scenario)) {
          continue;
        }

        let problems;

        try {
          const instance = adapter.build(scenario, count, handlers);
          problems = verify(adapter, instance, scenario, count);
        } catch (error) {
          problems = [`threw ${error.constructor.name}: ${error.message}`];
        }

        if (problems.length > 0) {
          failures++;
          console.log(`FAIL  ${adapter.name} [${scenario}, ${count} routes]`);

          for (const problem of problems) {
            console.log(`        ${problem}`);
          }
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
  const setup = [];

  for (const scenario of SCENARIOS) {
    for (const count of ROUTE_COUNTS) {
      const handlers = makeHandlers(count);

      for (const adapter of adapters) {
        if (!adapter.supports.includes(scenario)) {
          continue;
        }

        const instance = adapter.build(scenario, count, handlers);
        const cells = {};

        for (const target of TARGETS) {
          const request = requestFor(scenario, count, target);
          cells[target] = measure(instance.match, request);
        }

        results.push({ scenario, routes: count, adapter: adapter.name, ns: cells });

        process.stdout.write(
          `${scenario.padEnd(7)} ${String(count).padStart(5)}  ${adapter.name.padEnd(48)}` +
            TARGETS.map((t) => `${t}=${formatNs(cells[t].median)}`.padEnd(16)).join('') +
            '\n'
        );
      }

      console.log('');
    }
  }

  for (const scenario of SCENARIOS) {
    for (const adapter of adapters) {
      if (!adapter.supports.includes(scenario)) {
        continue;
      }

      setup.push({
        scenario,
        adapter: adapter.name,
        routes1000Ms: measureSetup(adapter, scenario, 1000),
      });
    }
  }

  writeOutputs(results, setup);
}

function writeOutputs(results, setup) {
  const environment = {
    versions: VERSIONS,
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0] ? os.cpus()[0].model : 'unknown',
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
    for (const count of ROUTE_COUNTS) {
      lines.push(`## ${scenario} routes, ${count} registered`, '');
      lines.push('| Router | first | middle | last | miss |');
      lines.push('|---|---:|---:|---:|---:|');

      for (const row of results.filter((r) => r.scenario === scenario && r.routes === count)) {
        lines.push(`| ${row.adapter} | ${TARGETS.map((t) => formatNs(row.ns[t].median)).join(' | ')} |`);
      }

      lines.push('');
    }
  }

  lines.push('## Setup time with 1000 routes (register all routes, then the first match), milliseconds', '');
  lines.push('| Router | static | param |');
  lines.push('|---|---:|---:|');

  for (const adapter of adapters) {
    const staticRow = setup.find((s) => s.scenario === 'static' && s.adapter === adapter.name);
    const paramRow = setup.find((s) => s.scenario === 'param' && s.adapter === adapter.name);

    lines.push(`| ${adapter.name} | ${staticRow ? staticRow.routes1000Ms.toFixed(2) : 'n/a'} | ${paramRow ? paramRow.routes1000Ms.toFixed(2) : 'n/a'} |`);
  }

  lines.push('');
  fs.writeFileSync('results.md', lines.join('\n'));

  console.log('Wrote results.md and results.json');
}

main();
