import { BaseCache } from "@langchain/core/caches";
import { Generation } from "@langchain/core/outputs";
import { logger } from "../logger.js";

interface CacheEntry {
  value: Generation[];
  timestamp: number;
  hits: number;
}

export class InMemoryCacheImpl extends BaseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private ttl: number;
  private cleanupInterval: NodeJS.Timeout;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(ttlSeconds: number = 3600) {
    super();
    this.ttl = ttlSeconds * 1000;

    this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
  }

  private getCacheKey(prompt: string, llmKey: string): string {
    return `${llmKey}:${prompt}`;
  }

  async lookup(prompt: string, llmKey: string): Promise<Generation[] | null> {
    const key = this.getCacheKey(prompt, llmKey);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.stats.evictions++;
      this.stats.misses++;
      return null;
    }

    entry.hits++;
    this.stats.hits++;

    logger.debug(
      {
        cacheKey: key.substring(0, 50),
        hits: entry.hits,
        age: Math.round((now - entry.timestamp) / 1000),
        totalHits: this.stats.hits,
        totalMisses: this.stats.misses,
      },
      "Cache hit",
    );

    return entry.value;
  }

  async update(
    prompt: string,
    llmKey: string,
    value: Generation[],
  ): Promise<void> {
    const key = this.getCacheKey(prompt, llmKey);

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0,
    });

    logger.debug(
      {
        cacheKey: key.substring(0, 50),
        cacheSize: this.cache.size,
      },
      "Cache entry added",
    );
  }

  private cleanup(): void {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        evicted++;
      }
    }

    if (evicted > 0) {
      this.stats.evictions += evicted;
      logger.debug(
        {
          evicted,
          remainingEntries: this.cache.size,
          totalEvictions: this.stats.evictions,
        },
        "Cache cleanup completed",
      );
    }
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.evictions += size;
    logger.info({ entriesCleared: size }, "Cache cleared");
  }

  getStats() {
    const hitRate =
      this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
        : 0;

    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: hitRate.toFixed(2) + "%",
    };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clear();
  }
}
