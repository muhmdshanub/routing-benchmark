// The segment trie from section 8 of the article, unchanged except that the
// visit counter used for counting nodes has been removed so it does not add
// work to the timed loop.

function splitPath(pathname) {
  return pathname.split('/').filter(Boolean);
}

class Node {
  constructor() {
    this.statics = new Map();
    this.param = null;
    this.paramName = null;
    this.wildcard = null;
    this.handlers = new Map();
  }
}

class Router {
  constructor() {
    this.root = new Node();
  }

  add(method, pattern, handler) {
    let node = this.root;
    const segments = splitPath(pattern);

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      if (segment === '*') {
        if (!node.wildcard) {
          node.wildcard = new Map();
        }

        node.wildcard.set(method, handler);
        return;
      }

      if (segment.startsWith(':')) {
        if (!node.param) {
          node.param = new Node();
          node.paramName = segment.slice(1);
        }

        node = node.param;
      } else {
        if (!node.statics.has(segment)) {
          node.statics.set(segment, new Node());
        }

        node = node.statics.get(segment);
      }
    }

    node.handlers.set(method, handler);
  }

  find(method, pathname) {
    return this.search(this.root, splitPath(pathname), 0, {}, method);
  }

  search(node, segments, index, params, method) {
    if (index === segments.length) {
      const handler = node.handlers.get(method);
      return handler ? { handler, params } : null;
    }

    const segment = segments[index];
    const child = node.statics.get(segment);

    if (child) {
      const found = this.search(child, segments, index + 1, params, method);

      if (found) {
        return found;
      }
    }

    if (node.param) {
      const nextParams = { ...params, [node.paramName]: segment };
      const found = this.search(node.param, segments, index + 1, nextParams, method);

      if (found) {
        return found;
      }
    }

    if (node.wildcard) {
      const handler = node.wildcard.get(method);

      if (handler) {
        return { handler, params: { ...params, wildcard: segments.slice(index).join('/') } };
      }
    }

    return null;
  }
}

module.exports = { Router };
