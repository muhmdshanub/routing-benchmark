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
- cpu: AMD Ryzen 5 5600H with Radeon Graphics (12 logical cores)
- memory: 16 GB
- mode: full (5 rounds of about 60 ms)
- date: 2026-10-31T17:19:01.227Z

## static routes, 10 registered

| Router | first | middle | last | miss |
|---|---:|---:|---:|---:|
| if/else chain | 10.87 | 30.85 | 47.72 | 15.86 |
| switch (static only) | 14.62 | 33.15 | 48.81 | 20.78 |
| Map, key built per request (static only) | 89.12 | 95.46 | 88.94 | 91.97 |
| Map, key precomputed (diagnostic, static only) | 17.75 | 17.80 | 17.60 | 18.66 |
| Segment split + list scan | 111.4 | 236.9 | 327.1 | 295.2 |
| Ordered list of path-to-regexp matchers | 95.46 | 267.8 | 523.2 | 465.1 |
| Express 5 router: layer scan (internals) | 232.7 | 543.1 | 834.9 | 571.7 |
| find-my-way (Fastify) | 125.8 | 131.4 | 134.4 | 63.22 |
| Hono RegExpRouter | 52.27 | 52.23 | 52.26 | 94.18 |
| Hono TrieRouter | 284.6 | 335.8 | 320.6 | 167.8 |
| Hono SmartRouter (RegExp, Trie) | 61.04 | 61.30 | 61.15 | 102.4 |
| Hono LinearRouter | 647.5 | 632.8 | 629.3 | 632.1 |
| Hono PatternRouter | 503.9 | 438.7 | 504.1 | 450.9 |
| Segment trie (section 8) | 125.1 | 123.9 | 122.0 | 101.1 |

SmartRouter settled on: SmartRouter + RegExpRouter

## static routes, 100 registered

| Router | first | middle | last | miss |
|---|---:|---:|---:|---:|
| if/else chain | 21.28 | 293.5 | 695.2 | 423.8 |
| switch (static only) | 18.34 | 298.8 | 678.0 | 405.9 |
| Map, key built per request (static only) | 94.64 | 98.25 | 96.59 | 93.94 |
| Map, key precomputed (diagnostic, static only) | 21.59 | 21.61 | 18.13 | 21.39 |
| Segment split + list scan | 285.2 | 1446 | 2596 | 2380 |
| Ordered list of path-to-regexp matchers | 96.60 | 3643 | 7801 | 7610 |
| Express 5 router: layer scan (internals) | 232.8 | 4817 | 9501 | 9044 |
| find-my-way (Fastify) | 139.5 | 168.8 | 177.8 | 63.41 |
| Hono RegExpRouter | 50.88 | 51.03 | 51.02 | 91.89 |
| Hono TrieRouter | 568.0 | 581.6 | 586.5 | 164.4 |
| Hono SmartRouter (RegExp, Trie) | 54.28 | 54.46 | 54.03 | 94.60 |
| Hono LinearRouter | 5795 | 6806 | 6832 | 5970 |
| Hono PatternRouter | 7046 | 7080 | 7110 | 6926 |
| Segment trie (section 8) | 303.4 | 306.9 | 306.4 | 107.0 |

SmartRouter settled on: SmartRouter + RegExpRouter

## static routes, 1000 registered

| Router | first | middle | last | miss |
|---|---:|---:|---:|---:|
| if/else chain | 22.13 | 4657 | 10898 | 2999 |
| switch (static only) | 18.39 | 4025 | 10833 | 3026 |
| Map, key built per request (static only) | 105.3 | 249.3 | 244.8 | 97.58 |
| Map, key precomputed (diagnostic, static only) | 25.75 | 20.92 | 18.13 | 19.45 |
| Segment split + list scan | 290.5 | 11910 | 23397 | 26753 |
| Ordered list of path-to-regexp matchers | 117.0 | 56288 | 161637 | 158556 |
| Express 5 router: layer scan (internals) | 235.0 | 69794 | 182423 | 177229 |
| find-my-way (Fastify) | 140.3 | 195.3 | 210.4 | 63.66 |
| Hono RegExpRouter | 51.06 | 53.67 | 51.10 | 91.75 |
| Hono TrieRouter | 566.6 | 575.7 | 579.9 | 165.3 |
| Hono SmartRouter (RegExp, Trie) | 54.52 | 56.63 | 54.64 | 94.54 |
| Hono LinearRouter | 61916 | 71996 | 72793 | 62089 |
| Hono PatternRouter | 151306 | 151872 | 152150 | 150185 |
| Segment trie (section 8) | 299.4 | 305.6 | 305.9 | 101.5 |

SmartRouter settled on: SmartRouter + RegExpRouter

## param routes, 10 registered

| Router | first | middle | last | miss |
|---|---:|---:|---:|---:|
| if/else chain | 63.74 | 93.17 | 110.9 | 80.47 |
| Segment split + list scan | 212.3 | 332.0 | 422.9 | 297.4 |
| Ordered list of path-to-regexp matchers | 337.4 | 1044 | 1341 | 423.2 |
| Express 5 router: layer scan (internals) | 645.7 | 1496 | 1912 | 563.7 |
| find-my-way (Fastify) | 181.7 | 186.4 | 185.9 | 73.39 |
| Hono RegExpRouter | 230.7 | 246.0 | 260.0 | 115.8 |
| Hono TrieRouter | 575.1 | 580.3 | 572.1 | 192.1 |
| Hono SmartRouter (RegExp, Trie) | 233.7 | 246.4 | 259.5 | 118.4 |
| Hono LinearRouter | 3565 | 3755 | 3550 | 2686 |
| Hono PatternRouter | 653.1 | 570.0 | 638.1 | 467.8 |
| Segment trie (section 8) | 372.8 | 360.6 | 361.5 | 104.4 |

SmartRouter settled on: SmartRouter + RegExpRouter

## param routes, 100 registered

| Router | first | middle | last | miss |
|---|---:|---:|---:|---:|
| if/else chain | 263.0 | 337.8 | 875.0 | 836.1 |
| Segment split + list scan | 491.7 | 1379 | 2509 | 2397 |
| Ordered list of path-to-regexp matchers | 350.0 | 5309 | 9350 | 8138 |
| Express 5 router: layer scan (internals) | 642.0 | 6240 | 11178 | 9506 |
| find-my-way (Fastify) | 212.6 | 211.7 | 218.7 | 72.77 |
| Hono RegExpRouter | 1691 | 1856 | 1966 | 698.9 |
| Hono TrieRouter | 932.7 | 579.1 | 578.2 | 192.7 |
| Hono SmartRouter (RegExp, Trie) | 1710 | 1851 | 1952 | 703.7 |
| Hono LinearRouter | 28993 | 29229 | 28713 | 26586 |
| Hono PatternRouter | 7745 | 7492 | 7550 | 7396 |
| Segment trie (section 8) | 657.5 | 366.1 | 361.9 | 106.2 |

SmartRouter settled on: SmartRouter + RegExpRouter

## param routes, 1000 registered

| Router | first | middle | last | miss |
|---|---:|---:|---:|---:|
| if/else chain | 422.3 | 37882 | 23406 | 101834 |
| Segment split + list scan | 489.1 | 11682 | 23431 | 20664 |
| Ordered list of path-to-regexp matchers | 352.0 | 70591 | 168997 | 163101 |
| Express 5 router: layer scan (internals) | 646.6 | 84027 | 188068 | 182343 |
| find-my-way (Fastify) | 212.3 | 261.8 | 276.3 | 72.93 |
| Hono RegExpRouter | 10986 | 11925 | 13113 | 2459 |
| Hono TrieRouter | 935.5 | 578.4 | 571.3 | 192.0 |
| Hono SmartRouter (RegExp, Trie) | 10998 | 12142 | 13232 | 2494 |
| Hono LinearRouter | 304136 | 295528 | 298981 | 287165 |
| Hono PatternRouter | 164075 | 157958 | 157866 | 186332 |
| Segment trie (section 8) | 656.8 | 361.1 | 360.8 | 106.7 |

SmartRouter settled on: SmartRouter + RegExpRouter

## REST-style API, 51 routes (7 resources)

| Router | health | get item (middle) | delete item (middle) | nested (last) | miss | wrong method | mixed (16 rotating) |
|---|---:|---:|---:|---:|---:|---:|---:|
| if/else chain | 59.66 | 92.88 | 308.9 | 464.0 | 125.2 | 282.9 | 149.1 |
| Segment split + list scan | 111.4 | 522.4 | 693.1 | 1272 | 725.2 | 552.4 | 506.4 |
| Ordered list of path-to-regexp matchers | 94.03 | 2073 | 3771 | 3381 | 2113 | 4967 | 2068 |
| Express 5 router: layer scan (internals) | 250.1 | 2966 | 5416 | 5276 | 3234 | 7453 | 3260 |
| find-my-way (Fastify) | 109.1 | 188.6 | 223.3 | 298.5 | 71.42 | 29.35 | 187.9 |
| Hono RegExpRouter | 53.61 | 246.5 | 222.1 | 275.4 | 116.3 | 107.0 | 179.0 |
| Hono TrieRouter | 308.3 | 641.2 | 1011 | 1056 | 212.5 | 796.6 | 608.4 |
| Hono SmartRouter (RegExp, Trie) | 56.59 | 252.4 | 241.2 | 281.0 | 119.8 | 111.3 | 182.8 |
| Hono LinearRouter | 4486 | 5964 | 2865 | 6080 | 4405 | 349.2 | 4487 |
| Hono PatternRouter | 1471 | 1538 | 829.6 | 1666 | 1396 | 368.6 | 1307 |
| Segment trie (section 8) | 133.8 | 352.6 | 684.3 | 804.7 | 112.6 | 695.2 | 333.0 |

SmartRouter settled on: SmartRouter + RegExpRouter

## REST-style API, 492 routes (70 resources)

| Router | health | get item (middle) | delete item (middle) | nested (last) | miss | wrong method | mixed (16 rotating) |
|---|---:|---:|---:|---:|---:|---:|---:|
| if/else chain | 60.88 | 617.8 | 870.2 | 1716 | 1155 | 712.1 | 1095 |
| Segment split + list scan | 112.4 | 3443 | 2333 | 6902 | 5801 | 2412 | 2632 |
| Ordered list of path-to-regexp matchers | 94.22 | 16659 | 19050 | 35617 | 32189 | 36756 | 17386 |
| Express 5 router: layer scan (internals) | 239.2 | 20241 | 23013 | 51120 | 47569 | 53509 | 22811 |
| find-my-way (Fastify) | 108.5 | 214.2 | 243.4 | 344.2 | 71.49 | 29.46 | 223.0 |
| Hono RegExpRouter | 56.90 | 1742 | 1289 | 1841 | 532.3 | 108.0 | 1020 |
| Hono TrieRouter | 296.4 | 657.3 | 1001 | 1072 | 207.3 | 794.4 | 651.4 |
| Hono SmartRouter (RegExp, Trie) | 56.13 | 1723 | 1286 | 1834 | 536.1 | 111.5 | 1016 |
| Hono LinearRouter | 44554 | 45778 | 21921 | 47497 | 44037 | 3159 | 37301 |
| Hono PatternRouter | 22147 | 18341 | 8688 | 18041 | 17649 | 3216 | 15269 |
| Segment trie (section 8) | 126.3 | 370.8 | 662.8 | 790.1 | 111.4 | 694.0 | 367.5 |

SmartRouter settled on: SmartRouter + RegExpRouter

## Setup time (register all routes, then the first match), milliseconds

| Router | static routes, 1000 registered | param routes, 1000 registered | REST-style API, 492 routes (70 resources) |
|---|---:|---:|---:|
| if/else chain | 0.20 | 1.32 | 0.49 |
| switch (static only) | 0.20 | n/a | n/a |
| Map, key built per request (static only) | 0.36 | n/a | n/a |
| Map, key precomputed (diagnostic, static only) | 0.35 | n/a | n/a |
| Segment split + list scan | 0.42 | 0.51 | 0.24 |
| Ordered list of path-to-regexp matchers | 2.71 | 3.27 | 1.46 |
| Express 5 router: layer scan (internals) | 6.97 | 7.14 | 3.35 |
| find-my-way (Fastify) | 5.00 | 7.87 | 3.34 |
| Hono RegExpRouter | 2.13 | 5.76 | 2.32 |
| Hono TrieRouter | 1.57 | 2.16 | 0.77 |
| Hono SmartRouter (RegExp, Trie) | 2.20 | 6.23 | 2.31 |
| Hono LinearRouter | 0.12 | 0.36 | 0.07 |
| Hono PatternRouter | 1.97 | 2.97 | 0.98 |
| Segment trie (section 8) | 0.57 | 0.79 | 0.24 |

## Noisy cells (min to max range above 10% of the median)

| Scenario | Router | Request | min | median | max |
|---|---|---|---:|---:|---:|
| param routes, 1000 registered | if/else chain | last | 23191 | 23406 | 102928 |
| static routes, 1000 registered | Hono LinearRouter | middle | 71918 | 71996 | 108080 |
| static routes, 1000 registered | if/else chain | miss | 2972 | 2999 | 4415 |
| REST-style API, 492 routes (70 resources) | Hono PatternRouter | mixed (16 rotating) | 15223 | 15269 | 21733 |
| REST-style API, 51 routes (7 resources) | Hono PatternRouter | get item (middle) | 1514 | 1538 | 2036 |
| static routes, 1000 registered | if/else chain | last | 10865 | 10898 | 14210 |
| static routes, 1000 registered | switch (static only) | last | 9004 | 10833 | 12269 |
| static routes, 100 registered | Segment trie (section 8) | miss | 104.5 | 107.0 | 135.8 |
| param routes, 10 registered | Hono SmartRouter (RegExp, Trie) | miss | 117.6 | 118.4 | 152.2 |
| static routes, 1000 registered | Segment split + list scan | miss | 21947 | 26753 | 29745 |
| REST-style API, 492 routes (70 resources) | Segment trie (section 8) | mixed (16 rotating) | 365.1 | 367.5 | 450.2 |
| static routes, 1000 registered | Ordered list of path-to-regexp matchers | first | 98.21 | 117.0 | 125.0 |
| REST-style API, 51 routes (7 resources) | Segment trie (section 8) | health | 129.0 | 133.8 | 158.3 |
| param routes, 1000 registered | Hono SmartRouter (RegExp, Trie) | middle | 11900 | 12142 | 14503 |
| param routes, 1000 registered | Hono PatternRouter | miss | 157944 | 186332 | 191724 |
| static routes, 1000 registered | Map, key precomputed (diagnostic, static only) | last | 18.04 | 18.13 | 21.32 |
| static routes, 1000 registered | switch (static only) | miss | 2940 | 3026 | 3456 |
| static routes, 1000 registered | switch (static only) | first | 18.31 | 18.39 | 21.45 |
| REST-style API, 51 routes (7 resources) | Segment trie (section 8) | delete item (middle) | 664.6 | 684.3 | 774.8 |
| REST-style API, 492 routes (70 resources) | Segment trie (section 8) | get item (middle) | 349.9 | 370.8 | 406.5 |
| static routes, 1000 registered | Map, key built per request (static only) | miss | 96.20 | 97.58 | 111.0 |
| param routes, 10 registered | Hono PatternRouter | last | 624.9 | 638.1 | 714.9 |
| param routes, 100 registered | Ordered list of path-to-regexp matchers | middle | 5269 | 5309 | 5989 |
| param routes, 10 registered | Hono LinearRouter | middle | 3675 | 3755 | 4172 |
| static routes, 1000 registered | Map, key precomputed (diagnostic, static only) | middle | 19.69 | 20.92 | 22.39 |
| static routes, 10 registered | Hono TrieRouter | last | 300.0 | 320.6 | 340.3 |
| static routes, 100 registered | Map, key precomputed (diagnostic, static only) | middle | 21.54 | 21.61 | 24.18 |
| param routes, 10 registered | Express 5 router: layer scan (internals) | middle | 1467 | 1496 | 1634 |
| REST-style API, 51 routes (7 resources) | Hono PatternRouter | nested (last) | 1644 | 1666 | 1824 |
| param routes, 1000 registered | Hono LinearRouter | last | 292369 | 298981 | 323204 |
