# Functional Testing Plan

## Goals
- Verify habit widget rendering, command execution, vault mutations, and streak logic through automated functional tests.
- Ensure localization works across supported languages.
- Provide infrastructure to extend coverage when new features ship.

## Approach Options

### 1. Node-based Harness
- Build fake Obsidian objects (`App`, `Vault`, `TFile`, `MarkdownPostProcessorContext`).
- Use in-memory vault implementation (Map-based filesystem) for create/append/read.
- Leverage JSDOM for DOM, running widget rendering and command callbacks in tests.
- Test scenarios:
  - Parse YAML block options and resolve defaults.
  - Render heatmap (grid/row) and verify DOM classes/states.
  - Click habit button and confirm fake vault logs entry, streak updates, and DOM reflects `is-done`.
  - Validate localization swaps strings when changing `plugin.settings.locale`.
- Pros: fast, easy to run in CI, deterministic.
- Cons: need to maintain API parity with Obsidian’s interfaces.

### 2. Playwright / Electron E2E
- Launch actual Obsidian app (Electron) pointing to a fixture vault.
- Automate with Playwright (via CDP) to open notes, insert code blocks, toggle commands, and assert UI.
- Reset fixture vault between tests.
- Pros: highest fidelity.
- Cons: heavier setup, slower execution, more brittle.

### 3. Hybrid Strategy
- Core logic covered via Node harness.
- Light smoke tests via Playwright to ensure integration with real Obsidian.

## Infrastructure Tasks
1. Create `tests/` directory with dedicated tooling (Jest or Vitest).
2. Implement fake vault + app harness.
3. Add helper to mount widget for given source string.
4. Write initial tests for:
   - Block parsing (YAML, defaults).
   - Habit logging (file creation/appending, streak recalculation).
   - Localization toggling.
5. (Optional) Configure Playwright project with fixture vault for end-to-end checks.
6. Add npm scripts (`test:functional`, `test:e2e`).
7. Document how to run tests locally and in CI.

## Open Questions
- Which test runner (Jest, Vitest) fits current toolchain best?
- How to mock Notices (spy vs. stub) for assertions.
- E2E feasibility on CI (headless Electron, licensing, runtime).

## Next Steps
- Decide on runner and start with Node harness implementation.
- Draft first tests: streak logic + click flow.
- Evaluate feasibility of automated Obsidian launch for E2E.

## Current Plugin Functionality
- Markdown code block `habit-button` renders a habit card with icon, meta row, and heatmap.
- YAML options supported: title (required), icon, warnHoursThreshold, heatLayout (grid/row), weeks, days, dailyFolder, templatePath, cellSize, cellGap, dotSize, dotGap.
- Layout selection switches between weekly grid and rolling-day row heatmaps; intensities map to dot-l1..l4 classes.
- Card reflects completion state for today (`is-done` classes, button text swap).
- Clicking the button appends an entry to today’s daily note (creates file if missing, optionally seeded from `templatePath`).
- Habit entries parsed from configured daily folder across vault; counts, streak, last timestamps tracked per ISO date.
- Streak logic uses warnHoursThreshold to decide allowed gap; overdue hint shows `<Nh 🔥` when close to breaking streak.
- Settings tab: change daily folder, daily template path, default layout, grid weeks (slider 4–52), row days (slider 30–365), and interface language (auto/en/ru).
- Command palette entry inserts a pre-configured `habit-button` code block snippet.
- Localization auto-detects vault language or uses user-selected override; all UI strings switch accordingly.
- Styles sheet injected on load and removed on unload.

