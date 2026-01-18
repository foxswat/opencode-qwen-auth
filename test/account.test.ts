import { describe, expect, it } from "bun:test";
import {
  type AccountStorage,
  getMinRateLimitWait,
  markRateLimited,
  selectAccount,
} from "../src/plugin/account";

function createStorage(): AccountStorage {
  const now = Date.now();
  return {
    version: 1,
    activeIndex: 0,
    accounts: [
      { refreshToken: "r1", addedAt: now, lastUsed: now },
      { refreshToken: "r2", addedAt: now, lastUsed: now },
    ],
  };
}

describe("selectAccount", () => {
  it("rotates in round-robin mode", () => {
    const now = Date.now();
    const storage = createStorage();

    const first = selectAccount(storage, "round-robin", now);
    expect(first?.index).toBe(1);

    const second = selectAccount(first?.storage ?? storage, "round-robin", now);
    expect(second?.index).toBe(0);
  });

  it("sticks to active index in sequential mode", () => {
    const now = Date.now();
    const storage = createStorage();

    const selected = selectAccount(storage, "sequential", now);
    expect(selected?.index).toBe(0);
  });

  it("skips rate-limited accounts", () => {
    const now = Date.now();
    const storage = createStorage();
    const limited = markRateLimited(storage, 0, 60_000);

    const selected = selectAccount(limited, "sequential", now);
    expect(selected?.index).toBe(1);
  });
});

describe("getMinRateLimitWait", () => {
  it("returns the minimum wait time", () => {
    const now = Date.now();
    const storage = createStorage();
    const limited = markRateLimited(storage, 0, 120_000);
    const limitedAgain = markRateLimited(limited, 1, 60_000);

    const wait = getMinRateLimitWait(limitedAgain, now);
    expect(wait).toBeGreaterThanOrEqual(60_000);
    expect(wait).toBeLessThan(120_000 + 1000);
  });
});
