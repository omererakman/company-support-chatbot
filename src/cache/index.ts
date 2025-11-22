import { BaseCache } from "@langchain/core/caches";
import { Generation } from "@langchain/core/outputs";
import { getConfig } from "../config/index.js";
import { logger } from "../logger.js";
import { InMemoryCacheImpl } from "./in-memory.js";

let cacheInstance: BaseCache | null = null;

export function createCache(): BaseCache {
  if (cacheInstance) {
    return cacheInstance;
  }

  const config = getConfig();

  if (!config.cacheEnabled) {
    logger.debug("Cache is disabled");
    return createNoOpCache();
  }

  logger.info({ type: "in-memory", ttl: config.cacheTtl }, "Cache initialized");
  cacheInstance = new InMemoryCacheImpl(config.cacheTtl);

  return cacheInstance;
}

function createNoOpCache(): BaseCache {
  return new (class extends BaseCache {
    async lookup(
      _prompt: string,
      _llmKey: string,
    ): Promise<Generation[] | null> {
      return null;
    }
    async update(
      _prompt: string,
      _llmKey: string,
      _value: Generation[],
    ): Promise<void> {}
  })();
}

interface CacheWithClear extends BaseCache {
  clear(): void;
}

export function clearCache(): void {
  if (
    cacheInstance &&
    "clear" in cacheInstance &&
    typeof cacheInstance.clear === "function"
  ) {
    (cacheInstance as CacheWithClear).clear();
    logger.info("Cache cleared");
  }
}

export { BaseCache };
