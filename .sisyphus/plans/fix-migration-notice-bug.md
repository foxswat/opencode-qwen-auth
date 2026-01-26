# Fix Migration Notice Bug - Only Show to Upgrading Users

## Context

### Original Request
User reports that the migration notice appears every time OpenCode launches for users who haven't explicitly created a `qwen.json` config file with `rotation_strategy` set. This is annoying because:
- New users never experienced the old "round-robin" default
- The notice appears on every launch
- Users shouldn't need to explicitly configure this

### Current Behavior
The warning appears like this in the terminal:
```
[qwen-auth] Note: Default rotation strategy changed from 'round-robin' to 'hybrid'.
            Set rotation_strategy: "round-robin" in config to keep previous behavior.
```

### Root Cause
In `src/plugin.ts` lines 267-280, the `showMigrationNoticeIfNeeded` function shows the notice when:
- `config.rotation_strategy === "hybrid"` (using default)
- `!config.isExplicitStrategy` (user didn't set it explicitly)
- `!config.quiet_mode`

This logic cannot distinguish between:
- **Upgrading users** (had accounts before v0.3.0) → Should see notice once
- **New users** (installing for first time) → Should NOT see notice

### Research Findings
OpenCode provides a **Toast API** for displaying notifications:
```typescript
client.tui.showToast({
  title: "Migration Notice",
  message: "Default rotation strategy changed from 'round-robin' to 'hybrid'.",
  variant: "warning",
  duration: 8000
})
```

This is better than `console.log` because:
- Displays as a banner in the OpenCode TUI
- Automatically dismisses after duration
- Non-intrusive to the user experience

---

## Work Objectives

### Core Objective
Fix the migration notice to only show once to upgrading users (those with existing accounts), not to new users.

### Concrete Deliverables
- Modified `src/plugin/config/schema.ts` to add `migration_notice_shown` field
- Modified `src/plugin.ts` to check for existing accounts before showing notice
- Use OpenCode Toast API instead of console.log
- Migration notice shows only once per user

### Definition of Done
- [ ] New users (no accounts) never see the migration notice
- [ ] Upgrading users (with accounts) see the notice exactly once
- [ ] Notice displays as a Toast banner, not console.log
- [ ] Flag `migration_notice_shown` persists in user config after showing
- [ ] All existing tests pass
- [ ] Manual verification with both new and upgrading user scenarios

### Must Have
- Detection of existing accounts to identify upgrading users
- Flag persistence in user config to track notice was shown
- Toast API integration for better UX
- Backward compatibility (no breaking changes)

### Must NOT Have (Guardrails)
- Breaking changes to existing config schema
- Notice appearing multiple times to the same user
- Notice appearing to new users who never had round-robin
- Blocking/synchronous operations that slow down plugin initialization

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (bun test with 50 tests)
- **User wants tests**: Tests-after (add tests after implementation)
- **Framework**: bun test

### Manual QA Procedures

**Test Scenario 1: New User (No Accounts)**
- [ ] Delete accounts file: `rm ~/.config/opencode/qwen-auth-accounts.json`
- [ ] Delete user config: `rm ~/.config/opencode/qwen.json`
- [ ] Launch OpenCode: `opencode`
- [ ] Expected: No migration notice appears
- [ ] Evidence: Screenshot of clean OpenCode launch

**Test Scenario 2: Upgrading User (First Launch)**
- [ ] Setup: Ensure accounts exist at `~/.config/opencode/qwen-auth-accounts.json`
- [ ] Ensure user config has no `migration_notice_shown` flag
- [ ] Launch OpenCode: `opencode`
- [ ] Expected: Toast banner appears with migration notice
- [ ] Evidence: Screenshot of toast banner

**Test Scenario 3: Upgrading User (Second Launch)**
- [ ] Setup: Same as above, but `migration_notice_shown: true` in config
- [ ] Launch OpenCode: `opencode`
- [ ] Expected: No migration notice (already shown)
- [ ] Evidence: Screenshot of clean launch

**Test Scenario 4: Explicit Config User**
- [ ] Setup: User has `rotation_strategy: "round-robin"` in config
- [ ] Launch OpenCode: `opencode`
- [ ] Expected: No migration notice (explicit config = no need for notice)
- [ ] Evidence: Screenshot of clean launch

---

## Task Flow

```
Task 1 (schema) → Task 2 (plugin logic) → Task 3 (toast API)
                                              ↓
                                          Task 4 (manual test)
                                              ↓
                                          Task 5 (unit tests)
                                              ↓
                                          Task 6 (create PR)
                                              ↓
                                    Task 7 (oracle + librarian review)
                                              ↓
                                   Task 8 (merge PR + release)
```

## Parallelization

| Task | Depends On | Reason |
|------|------------|--------|
| 2 | 1 | Needs schema update first |
| 3 | 2 | Needs plugin logic updated |
| 4 | 3 | Needs implementation complete |
| 5 | 3 | Needs implementation complete (can run parallel with 4) |
| 6 | 5 | Needs all tests passing |
| 7 | 6 | Needs PR created to review |
| 8 | 7 | Needs review approval |

---

## TODOs

- [x] 1. Update config schema to add `migration_notice_shown` field

  **What to do**:
  - Open `src/plugin/config/schema.ts`
  - Add `migration_notice_shown: z.boolean().optional().default(false)` to the schema
  - This field tracks whether the migration notice has been shown to this user
  - Default is `false` so existing configs without this field will show the notice once

  **Must NOT do**:
  - Change the schema in a way that breaks existing configs
  - Make the field required (it must be optional for backward compatibility)

  **Parallelizable**: NO (base task)

  **References**:
  - `src/plugin/config/schema.ts` - Current schema definition
  - `src/plugin/config/loader.ts:6-8` - `LoadedConfig` interface extends the schema

  **Acceptance Criteria**:
  - [ ] Schema includes `migration_notice_shown?: boolean` with default `false`
  - [ ] TypeScript types updated automatically via Zod inference
  - [ ] `bun run build` → builds successfully with no type errors
  - [ ] Config still loads correctly with existing files (backward compatible)

  **Manual Verification**:
  - [ ] Test loading old config without the field:
    ```bash
    # Create test config without the new field
    echo '{"rotation_strategy": "hybrid"}' > test-config.json
    # Verify it loads with migration_notice_shown defaulting to false
    ```

  **Commit**: YES
  - Message: `fix(config): add migration_notice_shown flag to schema`
  - Files: `src/plugin/config/schema.ts`
  - Pre-commit: `bun run build && bun run lint`

---

- [x] 2. Modify plugin to check accounts and flag before showing notice

  **What to do**:
  - Open `src/plugin.ts`
  - Make `showMigrationNoticeIfNeeded` async (it needs to check accounts)
  - Add logic to check if accounts exist using `loadAccounts()`
  - Only show notice if:
    - Accounts exist (upgrading user)
    - `!config.migration_notice_shown` (haven't shown it yet)
    - `!config.isExplicitStrategy` (user didn't set strategy)
    - `!config.quiet_mode`
  - After showing, update the user config to set `migration_notice_shown: true`
  - Update the call site in `createQwenOAuthPlugin` to await the function

  **Must NOT do**:
  - Block plugin initialization (keep it fast)
  - Show notice to new users (no accounts)
  - Show notice multiple times

  **Parallelizable**: NO (depends on 1)

  **References**:
  - `src/plugin.ts:267-280` - Current `showMigrationNoticeIfNeeded` function
  - `src/plugin/account.ts:144-164` - `loadAccounts()` function signature and behavior
  - `src/plugin/config/loader.ts:85-106` - How config loading works

  **Acceptance Criteria**:
  - [ ] Function is now `async function showMigrationNoticeIfNeeded(config: LoadedConfig): Promise<void>`
  - [ ] Calls `loadAccounts()` to check for existing accounts
  - [ ] Shows notice only if `existingAccounts && existingAccounts.accounts.length > 0 && !config.migration_notice_shown`
  - [ ] Call site updated: `await showMigrationNoticeIfNeeded(config);` (line ~289)
  - [ ] `bun run build` → successful
  - [ ] `bun test` → all tests pass

  **Manual Verification**:
  - [ ] With accounts present and flag=false → Logic should proceed to show notice
  - [ ] With no accounts → Logic should skip showing notice
  - [ ] With flag=true → Logic should skip showing notice

  **Commit**: YES
  - Message: `fix(plugin): only show migration notice to upgrading users`
  - Files: `src/plugin.ts`
  - Pre-commit: `bun test`

---

- [ ] 3. Replace console.log with Toast API and persist flag

  **What to do**:
  - In `src/plugin.ts`, inside `showMigrationNoticeIfNeeded`:
    - Instead of `console.log()`, use `client.tui.showToast()`
    - But wait - `client` is not available in this function!
    - Need to refactor: Pass `client` as a parameter
  - Change signature: `showMigrationNoticeIfNeeded(config: LoadedConfig, client: PluginClient)`
  - Use Toast API:
    ```typescript
    await client.tui.showToast({
      title: "Migration Notice",
      message: "Default rotation strategy changed from 'round-robin' to 'hybrid'. Set rotation_strategy in config if you prefer the old behavior.",
      variant: "warning",
      duration: 8000
    });
    ```
  - After showing toast, persist the flag:
    - Update user config file to set `migration_notice_shown: true`
    - Use existing config file utilities if available, or write directly to `~/.config/opencode/qwen.json`
  - Update call site to pass `client` parameter

  **Must NOT do**:
  - Use console.log (the old method)
  - Fail silently if Toast API errors (catch and log errors)
  - Write to project config (use user config at `~/.config/opencode/qwen.json`)

  **Parallelizable**: NO (depends on 2)

  **References**:
  - `src/plugin.ts:284-298` - `createQwenOAuthPlugin` has access to `client`
  - OpenCode Toast API documentation (from librarian research):
    ```typescript
    client.tui.showToast({
      title?: string;
      message: string;
      variant: "info" | "success" | "warning" | "error";
      duration?: number;
    })
    ```
  - `src/plugin/config/loader.ts:19-22` - `getUserConfigPath()` function for getting config path

  **Implementation Notes**:
  - Need to create a helper function to update user config:
    ```typescript
    async function updateUserConfig(updates: Partial<QwenPluginConfig>): Promise<void> {
      const configPath = getUserConfigPath();
      const existing = readJsonFile(configPath) ?? {};
      const merged = { ...existing, ...updates };
      await fs.writeFile(configPath, JSON.stringify(merged, null, 2), 'utf-8');
    }
    ```
  - Call this after showing the toast to persist `migration_notice_shown: true`

  **Acceptance Criteria**:
  - [ ] Toast appears in OpenCode TUI (not console)
  - [ ] Message is clear and actionable
  - [ ] After showing, user config file updated with `migration_notice_shown: true`
  - [ ] File: `~/.config/opencode/qwen.json` contains the flag after first launch
  - [ ] `bun run build` → successful
  - [ ] `bun test` → all tests pass

  **Manual Verification**:
  - [ ] Launch OpenCode with accounts present, flag=false
  - [ ] Toast banner appears with warning variant
  - [ ] After dismissal, check `~/.config/opencode/qwen.json` → contains `"migration_notice_shown": true`
  - [ ] Relaunch OpenCode → No toast appears (flag prevents it)

  **Commit**: YES
  - Message: `feat(plugin): use Toast API for migration notice and persist flag`
  - Files: `src/plugin.ts`, potentially new helper in `src/plugin/config/loader.ts`
  - Pre-commit: `bun test`

---

- [ ] 4. Manual end-to-end testing

  **What to do**:
  - Test all four scenarios described in Verification Strategy
  - Capture screenshots for each scenario
  - Document results
  - Verify no regressions in normal plugin operation

  **Must NOT do**:
  - Skip any test scenario
  - Test in production user account (use test account)

  **Parallelizable**: NO (depends on 3)

  **References**:
  - Verification Strategy section above for detailed steps

  **Acceptance Criteria**:
  - [ ] All 4 test scenarios completed successfully
  - [ ] Screenshots captured as evidence
  - [ ] No regressions in normal plugin operation (can still auth, rotate accounts, make requests)

  **Manual Verification**:
  - See Verification Strategy section for complete steps

  **Commit**: NO (testing only, no code changes)

---

- [ ] 5. Write unit tests for migration notice logic

  **What to do**:
  - Create test file: `test/migration-notice.test.ts`
  - Test cases:
    1. New user (no accounts) → notice not shown
    2. Upgrading user (accounts exist, flag=false) → notice shown once
    3. User with flag=true → notice not shown
    4. User with explicit strategy → notice not shown
    5. Quiet mode enabled → notice not shown
  - Mock `loadAccounts()` to return controlled test data
  - Mock `client.tui.showToast` to verify it's called correctly
  - Verify config update persists the flag

  **Must NOT do**:
  - Write flaky tests that depend on filesystem state
  - Skip mocking (don't hit real config files)

  **Parallelizable**: YES (with 4 - can run in parallel)

  **References**:
  - Existing test patterns in `test/` directory
  - `test/account.test.ts` - Examples of mocking account storage
  - `src/plugin.ts:267-280` - Function under test

  **Acceptance Criteria**:
  - [ ] Test file created: `test/migration-notice.test.ts`
  - [ ] All 5 test cases implemented and passing
  - [ ] Mocks properly configured (no real file I/O)
  - [ ] `bun test` → all tests pass including new ones
  - [ ] Test coverage includes edge cases (null accounts, empty accounts array)

  **Manual Verification**:
  - [ ] Run tests: `bun test test/migration-notice.test.ts`
  - [ ] Expected: All tests pass
  - [ ] Run full suite: `bun test`
  - [ ] Expected: 55+ tests pass (50 existing + 5 new)

  **Commit**: YES
  - Message: `test(plugin): add tests for migration notice logic`
  - Files: `test/migration-notice.test.ts`
  - Pre-commit: `bun test`

---

- [ ] 6. Create Pull Request

  **What to do**:
  - Ensure all commits are pushed to feature branch
  - Create feature branch: `git checkout -b fix/migration-notice-spam`
  - Push all commits: `git push -u origin fix/migration-notice-spam`
  - Create PR using gh CLI:
    ```bash
    gh pr create --title "fix: migration notice only shows once to upgrading users" \
      --body "$(cat <<'EOF'
    ## Summary
    Fixes the bug where migration notice appears on every OpenCode launch for users without explicit rotation_strategy config.
    
    ## Changes
    - Add `migration_notice_shown` flag to config schema
    - Check for existing accounts to detect upgrading users
    - Replace console.log with Toast API banner
    - Persist flag in user config after showing
    - Add unit tests for migration notice logic
    
    ## Testing
    - ✅ New users (no accounts) never see notice
    - ✅ Upgrading users see notice exactly once
    - ✅ Toast banner displays correctly
    - ✅ Flag persists in user config
    - ✅ All 55+ tests pass
    
    Closes #[issue-number]
    EOF
    )"
    ```

  **Must NOT do**:
  - Push directly to main (branch protection enabled)
  - Create PR without running full test suite
  - Skip PR description

  **Parallelizable**: NO (depends on 5)

  **References**:
  - `AGENTS.md` - Contributing guidelines mention branch protection
  - Repository has CI that runs on ubuntu, macos, windows

  **Acceptance Criteria**:
  - [ ] Feature branch created and pushed
  - [ ] PR created with clear title and description
  - [ ] CI workflows triggered (ubuntu, macos, windows)
  - [ ] PR URL returned for tracking

  **Manual Verification**:
  - [ ] Command: `gh pr list` → Shows the new PR
  - [ ] Command: `gh pr view` → Shows PR details
  - [ ] GitHub Actions: All CI checks running

  **Commit**: NO (PR creation, not code change)

---

- [ ] 7. Request Oracle and Librarian Review

  **What to do**:
  - After PR is created, invoke oracle and librarian agents to review the changes
  - Oracle review prompt:
    ```
    Review PR #[number] for architectural soundness and potential issues:
    
    Changes:
    - Added migration_notice_shown flag to config
    - Modified plugin to check accounts before showing notice
    - Replaced console.log with Toast API
    - Added flag persistence to user config
    
    Please assess:
    1. Is the approach architecturally sound?
    2. Any potential race conditions or edge cases?
    3. Performance impact on plugin initialization?
    4. Security implications of persisting flag?
    5. Backward compatibility concerns?
    ```
  - Librarian review prompt:
    ```
    Review PR #[number] for best practices and code quality:
    
    Please verify:
    1. Proper use of OpenCode Toast API
    2. Config schema changes follow Zod best practices
    3. File I/O patterns are safe (locking, error handling)
    4. Test coverage is comprehensive
    5. Any similar patterns in other OpenCode plugins we should follow?
    ```
  - Document feedback from both agents
  - Address any issues raised before merging

  **Must NOT do**:
  - Skip review step (this is a quality gate)
  - Merge before addressing critical feedback
  - Ignore suggestions without documenting why

  **Parallelizable**: YES (oracle and librarian can review in parallel)

  **References**:
  - User requirement: "ask @oracle and @librarian to review it"
  - PR URL from task 6

  **Acceptance Criteria**:
  - [ ] Oracle agent consulted with PR details
  - [ ] Librarian agent consulted with PR details
  - [ ] Both reviews completed and documented
  - [ ] Any critical issues addressed
  - [ ] PR updated if changes needed

  **Manual Verification**:
  - [ ] Oracle review: Invoke delegate_task(subagent_type="oracle", prompt="...")
  - [ ] Librarian review: Invoke delegate_task(subagent_type="librarian", prompt="...")
  - [ ] Document findings: Add review summaries as PR comments
  - [ ] If approved: Add 👍 emoji to PR summary comment (per AGENTS.md)

  **Commit**: YES (if changes needed based on review)
  - Message: `fix: address [oracle/librarian] review feedback`
  - Files: [as needed]
  - Pre-commit: `bun test`

---

- [ ] 8. Merge PR and Create Release

  **What to do**:
  - After reviews approved and CI passes:
  - Merge the PR: `gh pr merge --squash --delete-branch`
  - Checkout main and pull: `git checkout main && git pull`
  - Create a patch release (bug fix):
    ```bash
    # Create version bump branch
    git checkout -b release/bump-patch
    
    # Bump version (creates commit)
    npm version patch --no-git-tag-version
    
    # Commit and create PR
    git add package.json
    git commit -m "chore: bump version to $(node -p "require('./package.json').version")"
    git push -u origin release/bump-patch
    
    gh pr create --title "chore: bump version for migration notice fix" \
      --body "Bump patch version for bug fix release"
    ```
  - After version PR merged:
    ```bash
    # Create GitHub release (triggers npm publish via OIDC)
    gh release create "v$(node -p "require('./package.json').version")" \
      --title "v$(node -p "require('./package.json').version")" \
      --notes "Fix: Migration notice only shows once to upgrading users
      
    See PR #[number] for details."
    ```

  **Must NOT do**:
  - Tag version manually (npm version handles it)
  - Push to npm manually (OIDC workflow handles it)
  - Skip version bump PR (bypasses CI)

  **Parallelizable**: NO (depends on 7)

  **References**:
  - `AGENTS.md` - Release process: version bump → PR → merge → GitHub release → auto-publish
  - Release workflow uses OIDC (no tokens needed)

  **Acceptance Criteria**:
  - [ ] PR merged successfully
  - [ ] Branch auto-deleted after merge
  - [ ] Version bump PR created and merged
  - [ ] GitHub release created with tag `vX.Y.Z`
  - [ ] Release workflow triggered
  - [ ] NPM package published automatically

  **Manual Verification**:
  - [ ] Check merged PR: `gh pr view [number]` → Status: Merged
  - [ ] Check release: `gh release list` → New version listed
  - [ ] Check npm: `npm view opencode-qwen-auth version` → Shows new version
  - [ ] Wait 2-3 mins for publish workflow to complete

  **Commit**: YES (version bump in separate PR)
  - Message: `chore: bump version to X.Y.Z`
  - Files: `package.json`
  - Pre-commit: none (just version bump)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `fix(config): add migration_notice_shown flag to schema` | `src/plugin/config/schema.ts` | `bun run build && bun run lint` |
| 2 | `fix(plugin): only show migration notice to upgrading users` | `src/plugin.ts` | `bun test` |
| 3 | `feat(plugin): use Toast API for migration notice and persist flag` | `src/plugin.ts`, config loader | `bun test` |
| 5 | `test(plugin): add tests for migration notice logic` | `test/migration-notice.test.ts` | `bun test` |
| 7 | `fix: address review feedback` (if needed) | [as needed] | `bun test` |
| 8 | `chore: bump version to X.Y.Z` | `package.json` | none |

---

## Success Criteria

### Verification Commands
```bash
# Build successfully
bun run build

# All tests pass (including new ones)
bun test

# Lint passes
bun run lint
```

### Final Checklist
- [ ] New users never see migration notice
- [ ] Upgrading users see notice exactly once
- [ ] Notice uses Toast API (banner format)
- [ ] Flag persists in user config
- [ ] All tests pass (50+ original + 5 new)
- [ ] No regressions in plugin functionality
- [ ] Manual testing completed for all 4 scenarios
- [ ] PR created with clear description
- [ ] Oracle review completed and issues addressed
- [ ] Librarian review completed and issues addressed
- [ ] CI passes on all platforms (ubuntu, macos, windows)
- [ ] PR merged to main
- [ ] Version bumped (patch release for bug fix)
- [ ] GitHub release created
- [ ] NPM package published automatically via OIDC
