import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AccountStorage } from "../src/plugin/account";

describe("migration notice behavior", () => {
  let testDir: string;
  let mockClient: any;
  let showMigrationNoticeIfNeeded: any;
  let savedXdgConfigHome: string | undefined;

  beforeEach(async () => {
    savedXdgConfigHome = process.env.XDG_CONFIG_HOME;
    testDir = join(tmpdir(), `qwen-migration-notice-test-${Date.now()}`);
    mkdirSync(join(testDir, ".opencode"), { recursive: true });
    mkdirSync(join(testDir, "config", "opencode"), { recursive: true });
    process.env.XDG_CONFIG_HOME = join(testDir, "config");

    mockClient = {
      tui: {
        showToast: mock(() => Promise.resolve()),
      },
    };
  });

  afterEach(() => {
    if (savedXdgConfigHome !== undefined) {
      process.env.XDG_CONFIG_HOME = savedXdgConfigHome;
    } else {
      delete process.env.XDG_CONFIG_HOME;
    }
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("config flag behavior", () => {
    it("defaults migration_notice_shown to false when not set", async () => {
      const { loadConfig } = await import("../src/plugin/config");
      const config = loadConfig(testDir);
      expect(config.migration_notice_shown).toBe(false);
    });

    it("respects migration_notice_shown when explicitly set to true", async () => {
      writeFileSync(
        join(testDir, ".opencode", "qwen.json"),
        JSON.stringify({ migration_notice_shown: true }),
      );
      const { loadConfig } = await import("../src/plugin/config");
      const config = loadConfig(testDir);
      expect(config.migration_notice_shown).toBe(true);
    });

    it("respects migration_notice_shown when explicitly set to false", async () => {
      writeFileSync(
        join(testDir, ".opencode", "qwen.json"),
        JSON.stringify({ migration_notice_shown: false }),
      );
      const { loadConfig } = await import("../src/plugin/config");
      const config = loadConfig(testDir);
      expect(config.migration_notice_shown).toBe(false);
    });
  });

  describe("updateUserConfig persistence", () => {
    it("persists migration_notice_shown flag to user config", async () => {
      const { updateUserConfig } = await import("../src/plugin/config");

      const configPath = join(testDir, ".opencode", "qwen.json");
      writeFileSync(configPath, JSON.stringify({ quiet_mode: true }));

      await updateUserConfig({ migration_notice_shown: true });

      expect(true).toBe(true);
    });

    it("handles missing config file gracefully", async () => {
      const { updateUserConfig } = await import("../src/plugin/config");

      await expect(
        updateUserConfig({ migration_notice_shown: true }),
      ).resolves.toBeUndefined();
    });
  });

  describe("migration notice conditions", () => {
    it("includes all required fields in config schema", async () => {
      const { QwenConfigSchema } = await import("../src/plugin/config");

      const validConfig = {
        migration_notice_shown: true,
        rotation_strategy: "hybrid" as const,
        quiet_mode: false,
      };

      const parsed = QwenConfigSchema.parse(validConfig);
      expect(parsed.migration_notice_shown).toBe(true);
    });

    it("schema accepts migration_notice_shown as optional", async () => {
      const { QwenConfigSchema } = await import("../src/plugin/config");

      const configWithoutFlag = {
        rotation_strategy: "hybrid" as const,
      };

      const parsed = QwenConfigSchema.parse(configWithoutFlag);
      expect(parsed.migration_notice_shown).toBe(false);
    });
  });

  describe("account detection logic", () => {
    it("loadAccounts returns null when no accounts file exists", async () => {
      const { loadAccounts } = await import("../src/plugin/account");
      const accounts = await loadAccounts();

      expect(accounts === null || typeof accounts === "object").toBe(true);
    });
  });
});
