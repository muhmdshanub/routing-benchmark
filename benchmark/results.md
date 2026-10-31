# Router-only benchmark results

Median nanoseconds per match (lower is better). Router only: no HTTP, no handler execution.

## Environment

- node: v26.13.0
- v8: 14.6.202.34-node.40
- find-my-way: 9.10.0
- hono: 4.13.14
- router: 2.2.0
- path-to-regexp (used by router): 8.4.2
- platform: win32 10.0.26200 x64
- cpu: AMD Ryzen 5 5600H with Radeon Graphics          (12 logical cores)
- memory: 16 GB
- mode: full (5 rounds of about 60 ms)
- date: 2026-10-31T07:27:57.938Z

## static routes, 10 registered

| Router | first | middle | last | miss |
|---|---:|---:|---:|---:|
| if/else chain | 13.88 | 48.32 | 79.45 | 12.79 |
| switch (static only) | 18.43 | 59.17 | 83.75 | 19.38 |
| Map, key built per request (static only) | 96.41 | 94.18 | 94.16 | 96.07 |
| Map, key precomputed (diagnostic, static only) | 17.10 | 15.32 | 15.31 | 15.83 |
| Segment split + list scan | 208.0 | 338.5 | 436.0 | 288.0 |
| Ordered list of path-to-regexp matchers | 93.29 | 268.9 | 523.9 | 464.0 |
| Express 5 router: layer scan (internals) | 215.4 | 539.4 | 805.8 | 589.6 |
| find-my-way (Fastify) | 125.3 | 128.0 | 130.3 | 61.50 |
| Hono RegExpRouter | 50.29 | 50.57 | 49.95 | 114.4 |
| Hono TrieRouter | 492.3 | 473.0 | 474.3 | 181.1 |
| Hono SmartRouter (RegExp, Trie) | 53.35 | 53.36 | 53.71 | 116.7 |
| Hono LinearRouter | 652.9 | 672.6 | 654.9 | 664.5 |
| Hono PatternRouter | 558.2 | 476.4 | 539.7 | 473.3 |
| Segment trie (section 8) | 249.6 | 251.7 | 252.4 | 96.34 |

## static routes, 100 registered

| Router | first | middle | last | miss |
|---|---:|---:|---:|---:|
| if/else chain | 21.12 | 345.8 | 726.9 | 399.8 |
| switch (static only) | 18.70 | 327.9 | 707.7 | 391.3 |
| Map, key built per request (static only) | 90.03 | 92.94 | 97.33 | 91.74 |
| Map, key precomputed (diagnostic, static only) | 15.99 | 15.86 | 16.15 | 16.47 |
| Segment split + list scan | 228.6 | 1446 | 2651 | 2532 |
| Ordered list of path-to-regexp matchers | 92.46 | 3686 | 7751 | 7700 |
| Express 5 router: layer scan (internals) | 218.0 | 4930 | 9755 | 9400 |
| find-my-way (Fastify) | 124.6 | 150.8 | 160.1 | 61.57 |
| Hono RegExpRouter | 49.84 | 49.89 | 50.42 | 100.9 |
| Hono TrieRouter | 478.0 | 471.9 | 472.1 | 182.3 |
| Hono SmartRouter (RegExp, Trie) | 53.22 | 53.27 | 53.80 | 103.3 |
| Hono LinearRouter | 5721 | 6215 | 6184 | 6207 |
| Hono PatternRouter | 7132 | 7119 | 7080 | 7102 |
| Segment trie (section 8) | 250.2 | 258.5 | 262.5 | 96.99 |

## static routes, 1000 registered

| Router | first | middle | last | miss |
|---|---:|---:|---:|---:|
| if/else chain | 22.16 | 5023 | 12427 | 2965 |
| switch (static only) | 22.57 | 4456 | 10339 | 2917 |
| Map, key built per request (static only) | 95.79 | 258.0 | 254.3 | 96.52 |
| Map, key precomputed (diagnostic, static only) | 17.19 | 15.95 | 15.85 | 18.03 |
| Segment split + list scan | 228.8 | 12306 | 24817 | 20793 |
| Ordered list of path-to-regexp matchers | 92.24 | 57681 | 162489 | 159767 |
| Express 5 router: layer scan (internals) | 219.3 | 70680 | 183893 | 179227 |
| find-my-way (Fastify) | 124.6 | 174.0 | 189.8 | 61.51 |
| Hono RegExpRouter | 50.01 | 50.43 | 49.96 | 100.4 |
| Hono TrieRouter | 476.9 | 474.0 | 492.4 | 182.3 |
| Hono SmartRouter (RegExp, Trie) | 54.24 | 54.30 | 53.90 | 105.6 |
| Hono LinearRouter | 56938 | 63164 | 62552 | 57023 |
| Hono PatternRouter | 154473 | 155905 | 157120 | 154538 |
| Segment trie (section 8) | 264.5 | 272.6 | 276.7 | 98.77 |

## param routes, 10 registered

| Router | first | middle | last | miss |
|---|---:|---:|---:|---:|
| if/else chain | 193.3 | 233.6 | 263.8 | 77.58 |
| Segment split + list scan | 388.1 | 525.3 | 622.9 | 298.8 |
| Ordered list of path-to-regexp matchers | 354.0 | 1087 | 1364 | 429.7 |
| Express 5 router: layer scan (internals) | 653.3 | 1554 | 1963 | 589.6 |
| find-my-way (Fastify) | 180.4 | 184.9 | 184.8 | 72.30 |
| Hono RegExpRouter | 224.1 | 245.2 | 251.6 | 112.0 |
| Hono TrieRouter | 833.9 | 830.0 | 835.9 | 189.4 |
| Hono SmartRouter (RegExp, Trie) | 232.3 | 244.1 | 249.6 | 113.4 |
| Hono LinearRouter | 3632 | 3656 | 3628 | 2881 |
| Hono PatternRouter | 594.8 | 535.0 | 602.8 | 455.2 |
| Segment trie (section 8) | 609.9 | 623.6 | 624.2 | 102.7 |

## param routes, 100 registered

| Router | first | middle | last | miss |
|---|---:|---:|---:|---:|
| if/else chain | 195.5 | 648.5 | 1241 | 776.6 |
| Segment split + list scan | 384.0 | 1616 | 2847 | 2578 |
| Ordered list of path-to-regexp matchers | 370.6 | 5109 | 9119 | 8025 |
| Express 5 router: layer scan (internals) | 653.1 | 6202 | 11363 | 9397 |
| find-my-way (Fastify) | 187.6 | 214.3 | 221.6 | 72.46 |
| Hono RegExpRouter | 1713 | 1833 | 1920 | 694.4 |
| Hono TrieRouter | 838.1 | 830.5 | 827.2 | 184.3 |
| Hono SmartRouter (RegExp, Trie) | 1694 | 1822 | 1930 | 689.6 |
| Hono LinearRouter | 29775 | 29769 | 29800 | 28033 |
| Hono PatternRouter | 7784 | 7743 | 7747 | 7513 |
| Segment trie (section 8) | 615.5 | 622.1 | 624.3 | 104.5 |

## param routes, 1000 registered

| Router | first | middle | last | miss |
|---|---:|---:|---:|---:|
| if/else chain | 356.8 | 41771 | 24786 | 97219 |
| Segment split + list scan | 383.8 | 12678 | 25579 | 21099 |
| Ordered list of path-to-regexp matchers | 360.1 | 69590 | 179096 | 170313 |
| Express 5 router: layer scan (internals) | 659.3 | 83949 | 208969 | 187281 |
| find-my-way (Fastify) | 188.8 | 273.1 | 274.3 | 72.67 |
| Hono RegExpRouter | 11138 | 12021 | 13288 | 2470 |
| Hono TrieRouter | 827.9 | 838.3 | 839.3 | 183.1 |
| Hono SmartRouter (RegExp, Trie) | 11029 | 12082 | 13279 | 2475 |
| Hono LinearRouter | 291765 | 294167 | 294807 | 286618 |
| Hono PatternRouter | 158940 | 159928 | 159675 | 158364 |
| Segment trie (section 8) | 611.4 | 621.5 | 630.9 | 108.7 |

## Setup time with 1000 routes (register all routes, then the first match), milliseconds

| Router | static | param |
|---|---:|---:|
| if/else chain | 0.13 | 0.25 |
| switch (static only) | 0.18 | n/a |
| Map, key built per request (static only) | 0.40 | n/a |
| Map, key precomputed (diagnostic, static only) | 0.34 | n/a |
| Segment split + list scan | 0.25 | 0.50 |
| Ordered list of path-to-regexp matchers | 2.27 | 3.31 |
| Express 5 router: layer scan (internals) | 7.05 | 6.89 |
| find-my-way (Fastify) | 5.73 | 7.99 |
| Hono RegExpRouter | 2.36 | 6.77 |
| Hono TrieRouter | 1.38 | 2.56 |
| Hono SmartRouter (RegExp, Trie) | 2.60 | 7.48 |
| Hono LinearRouter | 0.13 | 0.80 |
| Hono PatternRouter | 1.93 | 2.78 |
| Segment trie (section 8) | 0.55 | 1.16 |
