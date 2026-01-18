# For AI Coding Assistants

This file helps AI assistants understand this codebase.

## Project Overview

OpenCode plugin for Qwen OAuth authentication with:
- Device flow OAuth with PKCE
- Multi-account rotation (round-robin, sequential)
- Proactive token refresh
- Rate limit handling (429 detection)
- API translation: Responses API ↔ Chat Completions API

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Plugin entrypoint |
| `src/cli/install.ts` | CLI installer (`bunx opencode-qwen-auth install`) |
| `src/plugin/` | Core plugin logic, account management |
| `src/qwen/oauth.ts` | OAuth device flow implementation |
| `src/transform/` | API request/response transformation |

## Commands

```bash
bun install     # Install dependencies
bun test        # Run tests (50 tests)
bun run build   # Build for production
bun run lint    # Run Biome linter
```

## Testing

- Unit tests: `test/*.test.ts` (auth, token, transform, account, url, cli)
- Mock server: `test/mock-server/server.ts`
- E2E tests: `test/e2e.test.ts`

## Architecture

```
OpenCode → [Responses API] → Plugin → [Chat Completions] → Qwen API
                                ↓
                          Token refresh
                          Account rotation
                          Rate limit handling
```

## Configuration

User config: `~/.config/opencode/qwen.json`
Project config: `.opencode/qwen.json`
Account tokens: `~/.config/opencode/qwen-auth-accounts.json`

## Key Patterns

- Uses `proper-lockfile` for file locking during account storage
- SSE streaming transformation in `src/transform/sse.ts`
- Zod schemas for configuration validation
