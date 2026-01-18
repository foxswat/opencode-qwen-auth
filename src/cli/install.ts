#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PLUGIN_NAME = "opencode-qwen-auth";

const DEFAULT_PROVIDER_CONFIG = {
  qwen: {
    npm: "@ai-sdk/openai",
    options: {
      baseURL: "https://portal.qwen.ai/v1",
      compatibility: "strict",
    },
    models: {
      "qwen3-coder-plus": { contextWindow: 1048576 },
      "qwen3-vl-plus": { contextWindow: 262144, attachment: true },
    },
  },
};

interface OpencodeConfig {
  $schema?: string;
  plugin?: string[];
  provider?: Record<string, unknown>;
  [key: string]: unknown;
}

function findConfigPath(): string | null {
  const candidates = [
    join(process.cwd(), "opencode.json"),
    join(process.cwd(), ".opencode", "opencode.json"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function getGlobalConfigPath(): string {
  const configDir =
    process.env.XDG_CONFIG_HOME || join(homedir(), ".config", "opencode");
  return join(configDir, "opencode.json");
}

function parseJsonc(content: string): OpencodeConfig {
  const result = content;
  let inString = false;
  let escaped = false;
  let output = "";

  for (let i = 0; i < result.length; i++) {
    const char = result[i];
    const nextChar = result[i + 1];

    if (escaped) {
      output += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      output += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      output += char;
      continue;
    }

    if (!inString) {
      if (char === "/" && nextChar === "/") {
        while (i < result.length && result[i] !== "\n") {
          i++;
        }
        continue;
      }
      if (char === "/" && nextChar === "*") {
        i += 2;
        while (
          i < result.length &&
          !(result[i] === "*" && result[i + 1] === "/")
        ) {
          i++;
        }
        i++;
        continue;
      }
    }

    output += char;
  }

  return JSON.parse(output);
}

function loadConfig(configPath: string): OpencodeConfig {
  try {
    const content = readFileSync(configPath, "utf-8");
    return parseJsonc(content);
  } catch {
    return {};
  }
}

function saveConfig(configPath: string, config: OpencodeConfig): void {
  const dir = join(configPath, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

function hasPlugin(config: OpencodeConfig): boolean {
  if (!config.plugin || !Array.isArray(config.plugin)) {
    return false;
  }
  return config.plugin.some(
    (p) => p === PLUGIN_NAME || p.startsWith(`${PLUGIN_NAME}@`),
  );
}

function hasQwenProvider(config: OpencodeConfig): boolean {
  return !!(
    config.provider &&
    typeof config.provider === "object" &&
    "qwen" in config.provider
  );
}

function addPlugin(config: OpencodeConfig): OpencodeConfig {
  const updated: OpencodeConfig = JSON.parse(JSON.stringify(config));

  if (!updated.$schema) {
    updated.$schema = "https://opencode.ai/config.json";
  }

  if (!updated.plugin) {
    updated.plugin = [];
  }

  if (!hasPlugin(updated)) {
    updated.plugin = [...updated.plugin, PLUGIN_NAME];
  }

  return updated;
}

function addProvider(config: OpencodeConfig): OpencodeConfig {
  const updated: OpencodeConfig = JSON.parse(JSON.stringify(config));

  if (!updated.provider) {
    updated.provider = {};
  }

  if (!hasQwenProvider(updated)) {
    updated.provider = {
      ...updated.provider,
      ...DEFAULT_PROVIDER_CONFIG,
    };
  }

  return updated;
}

function printSuccess(configPath: string, _isNew: boolean): void {
  console.log("");
  console.log("\x1b[32m✓\x1b[0m Qwen OAuth plugin installed successfully!");
  console.log("");
  console.log(`  Config: ${configPath}`);
  console.log("");
  console.log("\x1b[1mNext steps:\x1b[0m");
  console.log("");
  console.log("  1. Start OpenCode:");
  console.log("     \x1b[36mopencode\x1b[0m");
  console.log("");
  console.log("  2. Authenticate with Qwen:");
  console.log("     \x1b[36m/auth\x1b[0m");
  console.log("");
  console.log("  3. Select a Qwen model:");
  console.log("     \x1b[36m/model qwen/qwen3-coder-plus\x1b[0m");
  console.log("");
}

function printAlreadyInstalled(): void {
  console.log("");
  console.log("\x1b[33m⚠\x1b[0m Plugin already installed.");
  console.log("");
  console.log("  To authenticate, run \x1b[36m/auth\x1b[0m in OpenCode.");
  console.log("");
}

function printHelp(): void {
  console.log(`
\x1b[1m${PLUGIN_NAME}\x1b[0m - Qwen OAuth authentication plugin for OpenCode

\x1b[1mUSAGE:\x1b[0m
  bunx ${PLUGIN_NAME} <command>
  npx ${PLUGIN_NAME} <command>

\x1b[1mCOMMANDS:\x1b[0m
  install         Install plugin to opencode.json (project or global)
  install --global  Install to global config (~/.config/opencode/opencode.json)
  help            Show this help message

\x1b[1mEXAMPLES:\x1b[0m
  bunx ${PLUGIN_NAME} install
  npx ${PLUGIN_NAME} install --global

\x1b[1mMORE INFO:\x1b[0m
  https://github.com/foxswat/opencode-qwen-auth
`);
}

export function install(options: { global?: boolean } = {}): {
  success: boolean;
  configPath: string;
  alreadyInstalled: boolean;
} {
  let configPath: string;

  if (options.global) {
    configPath = getGlobalConfigPath();
  } else {
    const existingConfig = findConfigPath();
    configPath = existingConfig || join(process.cwd(), "opencode.json");
  }

  let config = existsSync(configPath) ? loadConfig(configPath) : {};
  const _isNew = Object.keys(config).length === 0;

  const alreadyHasPlugin = hasPlugin(config);
  const alreadyHasProvider = hasQwenProvider(config);

  if (alreadyHasPlugin && alreadyHasProvider) {
    return { success: true, configPath, alreadyInstalled: true };
  }

  config = addPlugin(config);
  config = addProvider(config);

  saveConfig(configPath, config);

  return { success: true, configPath, alreadyInstalled: false };
}

export function main(args: string[] = process.argv.slice(2)): void {
  const command = args[0];
  const flags = args.slice(1);

  switch (command) {
    case "install": {
      const isGlobal = flags.includes("--global") || flags.includes("-g");
      const result = install({ global: isGlobal });

      if (result.alreadyInstalled) {
        printAlreadyInstalled();
      } else {
        printSuccess(result.configPath, false);
      }
      break;
    }

    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;

    case undefined:
      printHelp();
      break;

    default:
      console.error(`\x1b[31mError:\x1b[0m Unknown command '${command}'`);
      console.error("");
      console.error(`Run '${PLUGIN_NAME} help' for usage.`);
      process.exit(1);
  }
}

main();
