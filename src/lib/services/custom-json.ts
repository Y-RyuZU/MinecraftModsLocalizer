export interface CustomJsonTextBundle {
  content: Record<string, string>;
  paths: Array<{ key: string; path: Array<string | number> }>;
}

/** Flatten JSON string values to stable temporary keys without exposing JSON keys for translation. */
export function extractCustomJsonText(value: unknown): CustomJsonTextBundle {
  const content: Record<string, string> = {};
  const paths: CustomJsonTextBundle["paths"] = [];

  const visit = (current: unknown, path: Array<string | number>) => {
    if (typeof current === "string") {
      const key = `custom.text.${paths.length}`;
      content[key] = current;
      paths.push({ key, path });
    } else if (Array.isArray(current)) {
      current.forEach((child, index) => visit(child, [...path, index]));
    } else if (current && typeof current === "object") {
      for (const [key, child] of Object.entries(current)) {
        if (!isCustomJsonMetadataKey(key)) visit(child, [...path, key]);
      }
    }
  };

  visit(value, []);
  return { content, paths };
}

/** Apply only a complete translation result, preserving JSON keys and non-string values. */
export function applyCustomJsonTranslations(
  source: unknown,
  bundle: CustomJsonTextBundle,
  translated: Record<string, string>
): unknown {
  const expected = bundle.paths.map(({ key }) => key);
  const missing = expected.filter((key) => typeof translated[key] !== "string");
  const extra = Object.keys(translated).filter((key) => !expected.includes(key));
  if (missing.length || extra.length) {
    throw new Error(`Invalid custom JSON translation (missing: ${missing.join(", ")}; extra: ${extra.join(", ")})`);
  }
  if (bundle.paths.some(({ path }) => path.length === 0)) {
    if (typeof source !== "string" || bundle.paths.length !== 1) throw new Error("Invalid root string translation path");
    return translated[bundle.paths[0].key];
  }

  const result: unknown = JSON.parse(JSON.stringify(source));
  for (const { key, path } of bundle.paths) {
    let parent = result;
    for (const segment of path.slice(0, -1)) {
      if (!parent || typeof parent !== "object" || !Object.hasOwn(parent, segment)) {
        throw new Error(`Custom JSON changed at ${path.join("/")}`);
      }
      parent = (parent as Record<string | number, unknown>)[segment];
    }
    const last = path[path.length - 1];
    if (last === undefined) throw new Error("Custom JSON string cannot be the root value");
    if (Array.isArray(parent)) {
      if (typeof last !== "number" || typeof parent[last] !== "string") throw new Error(`Custom JSON changed at ${path.join("/")}`);
      parent[last] = translated[key];
    } else if (parent && typeof parent === "object" && Object.hasOwn(parent, last) && typeof (parent as Record<string, unknown>)[last] === "string") {
      (parent as Record<string, unknown>)[last] = translated[key];
    } else {
      throw new Error(`Custom JSON changed at ${path.join("/")}`);
    }
  }
  return result;
}

function isCustomJsonMetadataKey(key: string): boolean {
  return ["id", "key", "modid", "type", "namespace", "resource", "registry"].includes(key.toLowerCase())
    || /(?:_id|Id|ID|_type|Type|_key|Key)$/.test(key);
}
