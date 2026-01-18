# OpenCode Qwen Auth Plugin

[![npm version](https://img.shields.io/npm/v/opencode-qwen-auth.svg)](https://www.npmjs.com/package/opencode-qwen-auth)
[![npm downloads](https://img.shields.io/npm/dm/opencode-qwen-auth.svg)](https://www.npmjs.com/package/opencode-qwen-auth)
[![CI](https://github.com/foxswat/opencode-qwen-auth/actions/workflows/ci.yml/badge.svg)](https://github.com/foxswat/opencode-qwen-auth/actions)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-black?logo=bun)](https://bun.sh)

Qwen OAuth authentication plugin for [OpenCode](https://opencode.ai) with multi-account rotation, proactive token refresh, and automatic API translation.

## Features

- **Device Flow OAuth** - PKCE-secured authentication, works in headless/CI environments
- **Multi-Account Support** - Store and rotate between multiple Qwen accounts
- **Proactive Token Refresh** - Automatically refresh tokens before expiry
- **Rate Limit Handling** - Detects 429 responses, rotates accounts, respects retry-after
- **API Translation** - Bridges OpenAI Responses API ↔ Chat Completions API
- **Streaming Support** - Full SSE transformation for real-time responses

## Installation

### Quick Install (Recommended)

Run one command to automatically configure OpenCode:

```bash
bunx opencode-qwen-auth install
# or
npx opencode-qwen-auth install
```

This adds the plugin and Qwen provider configuration to your `opencode.json`.

### Manual Installation

If you prefer manual setup:

```bash
# Using Bun
bun add opencode-qwen-auth

# Using npm
npm install opencode-qwen-auth
```

Then add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-qwen-auth"],
  "provider": {
    "qwen": {
      "npm": "@ai-sdk/openai",
      "options": {
        "baseURL": "https://portal.qwen.ai/v1",
        "compatibility": "strict"
      },
      "models": {
        "qwen3-coder-plus": { "contextWindow": 1048576 },
        "qwen3-vl-plus": { "contextWindow": 262144, "attachment": true }
      }
    }
  }
}
```

## Quick Start

1. Start OpenCode in your project directory:

   ```bash
   opencode
   ```

2. Authenticate with Qwen:

   ```
   /auth
   ```

   Select **Qwen OAuth** and follow the device flow instructions.

3. Start coding with Qwen models:
   ```
   /model qwen/qwen3-coder-plus
   ```

## Configuration

**No configuration required.** The plugin works out of the box with sensible defaults.

To customize behavior, create `.opencode/qwen.json` (project) or `~/.config/opencode/qwen.json` (user-level) with only the options you want to override:

```json
{
  "rotation_strategy": "sequential",
  "quiet_mode": true
}
```

### Configuration Options

| Option                        | Default                     | Description                                     |
| ----------------------------- | --------------------------- | ----------------------------------------------- |
| `base_url`                    | `https://portal.qwen.ai/v1` | API endpoint for Qwen requests                  |
| `client_id`                   | (built-in)                  | OAuth client ID                                 |
| `oauth_base_url`              | `https://chat.qwen.ai`      | OAuth server URL                                |
| `rotation_strategy`           | `round-robin`               | Account rotation: `round-robin` or `sequential` |
| `proactive_refresh`           | `true`                      | Refresh tokens before expiry                    |
| `refresh_window_seconds`      | `300`                       | Seconds before expiry to trigger refresh        |
| `max_rate_limit_wait_seconds` | `300`                       | Maximum wait time when rate limited             |
| `quiet_mode`                  | `false`                     | Suppress informational messages                 |

### Environment Variables

All options can be overridden via environment variables:

- `QWEN_API_BASE_URL`
- `QWEN_OAUTH_CLIENT_ID`
- `QWEN_OAUTH_BASE_URL`
- `QWEN_ROTATION_STRATEGY`
- `QWEN_PROACTIVE_REFRESH`
- `QWEN_REFRESH_WINDOW_SECONDS`
- `QWEN_MAX_RATE_LIMIT_WAIT_SECONDS`
- `QWEN_QUIET_MODE`

## Models

### Available via OAuth

| Model              | Context Window | Features                     |
| ------------------ | -------------- | ---------------------------- |
| `qwen3-coder-plus` | 1M tokens      | Optimized for coding tasks   |
| `qwen3-vl-plus`    | 256K tokens    | Vision + language multimodal |

## Multi-Account Rotation

Add multiple accounts for higher throughput:

1. Run `/auth` and complete the first login
2. Run `/auth` again to add additional accounts
3. The plugin automatically rotates between accounts

### Rotation Strategies

- **round-robin**: Cycles through accounts on each request
- **sequential**: Uses one account until rate limited, then switches

## How It Works

This plugin bridges OpenCode's Responses API format with Qwen's Chat Completions API:

```
OpenCode → [Responses API] → Plugin → [Chat Completions] → Qwen
                                ↓
OpenCode ← [Responses API] ← Plugin ← [Chat Completions] ← Qwen
```

### Request Transformation

| Responses API       | Chat Completions API     |
| ------------------- | ------------------------ |
| `input`             | `messages`               |
| `input_text`        | `text` content type      |
| `input_image`       | `image_url` content type |
| `instructions`      | System message           |
| `max_output_tokens` | `max_tokens`             |

### Response Transformation (Streaming)

Converts SSE events from Chat Completions to Responses API format:

- `response.created`
- `response.output_item.added`
- `response.content_part.added`
- `response.output_text.delta`
- `response.completed`

## Storage Locations

| Data           | Location                                     |
| -------------- | -------------------------------------------- |
| User config    | `~/.config/opencode/qwen.json`               |
| Project config | `.opencode/qwen.json`                        |
| Account tokens | `~/.config/opencode/qwen-auth-accounts.json` |

**Security Note**: Tokens are stored with restricted permissions (0600). Ensure appropriate filesystem security.

## Troubleshooting

### Authentication Issues

**"invalid_grant" error**

- Your refresh token has expired. Run `/auth` to re-authenticate.

**Device code expired**

- Complete the browser login within 5 minutes of starting `/auth`.

### Rate Limiting

**Frequent 429 errors**

- Add more accounts with `/auth`
- Increase `max_rate_limit_wait_seconds` in config

### Reset Plugin State

To start fresh, delete the accounts file:

```bash
rm ~/.config/opencode/qwen-auth-accounts.json
```

## Development

This project uses [Bun](https://bun.sh) for development.

### Prerequisites

- [Bun](https://bun.sh) 1.0+ (recommended)
- Node.js 20+ (for npm compatibility)

### Getting Started

```bash
# Install dependencies
bun install

# Build
bun run build

# Run tests
bun test

# Run tests in watch mode
bun test --watch

# Run e2e test (requires authenticated Qwen account)
bun run test:e2e

# Link for local testing
bun link
```

### Using npm

The project also works with npm:

```bash
npm install
npm run build
npm test
```

## Known Limitations

- Audio input (`input_audio`) is not supported by Qwen and is converted to placeholder text

## License

Apache-2.0
