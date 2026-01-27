import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createQwenOAuthPlugin } from "../src/plugin";

describe("startup hang fix (issue #13)", () => {
  let testDir: string;
  let configDir: string;
  let savedEnv: {
    XDG_CONFIG_HOME?: string;
    QWEN_ROTATION_STRATEGY?: string;
  };

  beforeEach(() => {
    savedEnv = {
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
      QWEN_ROTATION_STRATEGY: process.env.QWEN_ROTATION_STRATEGY,
    };

    testDir = join(tmpdir(), `qwen-startup-hang-test-${Date.now()}`);
    configDir = join(testDir, "opencode");

    mkdirSync(configDir, { recursive: true });
    mkdirSync(join(testDir, "project", ".opencode"), { recursive: true });

    process.env.XDG_CONFIG_HOME = testDir;
    delete process.env.QWEN_ROTATION_STRATEGY;
  });

  afterEach(() => {
    if (savedEnv.XDG_CONFIG_HOME !== undefined) {
      process.env.XDG_CONFIG_HOME = savedEnv.XDG_CONFIG_HOME;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }
    if (savedEnv.QWEN_ROTATION_STRATEGY !== undefined) {
      process.env.QWEN_ROTATION_STRATEGY = savedEnv.QWEN_ROTATION_STRATEGY;
    } else {
      delete process.env.QWEN_ROTATION_STRATEGY;
    }

    rmSync(testDir, { recursive: true, force: true });
  });

  it("plugin init completes within 250ms even when showToast never resolves", async () => {
    writeFileSync(
      join(configDir, "qwen.json"),
      JSON.stringify({
        quiet_mode: false,
        migration_notice_shown: false,
      }),
    );

    writeFileSync(
      join(configDir, "qwen-auth-accounts.json"),
      JSON.stringify({
        version: 1,
        activeIndex: 0,
        accounts: [
          {
            refreshToken: "dummy-refresh",
            accessToken: "dummy-access",
            expires: Date.now() + 3600000,
            addedAt: Date.now(),
            lastUsed: Date.now(),
          },
        ],
      }),
    );

    const hangingClient = {
      tui: {
        showToast: () => new Promise(() => {}),
      },
    };

    const ctx = {
      client: hangingClient,
      directory: join(testDir, "project"),
    };

    const pluginFactory = createQwenOAuthPlugin("qwen");

    const timeoutPromise = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), 250),
    );

    const result = await Promise.race([
      pluginFactory(ctx as any).then(() => "success" as const),
      timeoutPromise,
    ]);

    expect(result).toBe("success");
  });

  it("plugin init completes when showToast rejects", async () => {
    writeFileSync(
      join(configDir, "qwen.json"),
      JSON.stringify({
        quiet_mode: false,
        migration_notice_shown: false,
      }),
    );

    writeFileSync(
      join(configDir, "qwen-auth-accounts.json"),
      JSON.stringify({
        version: 1,
        activeIndex: 0,
        accounts: [
          {
            refreshToken: "dummy-refresh",
            accessToken: "dummy-access",
            expires: Date.now() + 3600000,
            addedAt: Date.now(),
            lastUsed: Date.now(),
          },
        ],
      }),
    );

    const rejectingClient = {
      tui: {
        showToast: () => Promise.reject(new Error("TUI not available")),
      },
    };

    const ctx = {
      client: rejectingClient,
      directory: join(testDir, "project"),
    };

    const pluginFactory = createQwenOAuthPlugin("qwen");
    const pluginResult = await pluginFactory(ctx as any);

    expect(pluginResult).toBeDefined();
    expect(pluginResult.auth).toBeDefined();
  });

  it("no unhandled promise rejections when toast rejects after init completes", async () => {
    writeFileSync(
      join(configDir, "qwen.json"),
      JSON.stringify({
        quiet_mode: false,
        migration_notice_shown: false,
      }),
    );

    writeFileSync(
      join(configDir, "qwen-auth-accounts.json"),
      JSON.stringify({
        version: 1,
        activeIndex: 0,
        accounts: [
          {
            refreshToken: "dummy-refresh",
            accessToken: "dummy-access",
            expires: Date.now() + 3600000,
            addedAt: Date.now(),
            lastUsed: Date.now(),
          },
        ],
      }),
    );

    let unhandledRejection = false;
    const handler = () => {
      unhandledRejection = true;
    };
    process.on("unhandledRejection", handler);

    const delayedRejectClient = {
      tui: {
        showToast: () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Delayed TUI error")), 50),
          ),
      },
    };

    const ctx = {
      client: delayedRejectClient,
      directory: join(testDir, "project"),
    };

    const pluginFactory = createQwenOAuthPlugin("qwen");
    await pluginFactory(ctx as any);

    await new Promise((resolve) => setTimeout(resolve, 100));

    process.off("unhandledRejection", handler);
    expect(unhandledRejection).toBe(false);
  });
});
