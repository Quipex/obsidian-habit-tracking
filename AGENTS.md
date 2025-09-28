# Repository Guidelines

## Project Structure & Module Organization
- `plugin/src/` — TypeScript source for the Habit Button plugin (entry point `main.ts`, settings UI, i18n helpers, styles import).
- `plugin/tests/` — Vitest harness, stubs, and behaviour tests (`harness.ts`, `render.test.ts`).
- `test_vault/` — Fixture Obsidian vault; `npm run deploy:test` copies build assets here for manual verification.
- `plans/` — Planning notes such as `tests.md` capturing future testing work.
- Root files: `.editorconfig` (2-space indent), `AGENTS.md` (this guide), `README.md` (Dataview widget legacy doc).

## Build, Test, and Development Commands
- `npm run build` (from `plugin/`): bundles the plugin via esbuild.
- `npm run deploy:test` (from `plugin/`): builds and syncs `manifest.json`, `main.js`, `styles.css` into `test_vault/.obsidian/plugins/habit-button/`.
- `npm run dev` (from `plugin/`): optional live build/watch; copies artefacts into `EXAMPLE_VAULT` if configured.
- `npm run test:functional` (from `plugin/`): runs Vitest suite in jsdom with Obsidian stubs.

## Coding Style & Naming Conventions
- Indentation: 2 spaces (enforced via `.editorconfig`).
- Use TypeScript (`.ts`) for plugin logic; keep module exports default where Obsidian expects (`main.ts` exports default `Plugin`).
- CSS class names follow `dv-habit-*`; localization keys use dot-separated paths (`settings.language.label`).
- Prefer explicit async/await and avoid `any` unless interacting with Obsidian’s untyped APIs.

## Testing Guidelines
- Framework: Vitest with jsdom and custom Obsidian stubs (`tests/stubs/obsidian.ts`).
- New behaviour tests belong in `plugin/tests/*.test.ts`; name files by scope (e.g., `habits.test.ts`).
- Use `renderHabitBlock` helper to mount widgets and assert DOM state; mock vault interactions via the harness.
- Structure specs with `// given`, `// when`, `// then` comments, and keep YAML fixtures in a separate `const habitDefinition = "..."` variable as in `plugin/tests/render.test.ts`.
- Run `npm run test:functional` before submitting changes; ensure no unhandled rejections appear in the output.

## Commit & Pull Request Guidelines
- Commit messages: use concise imperatives (e.g., `Add habit render harness`, `Fix localization dropdown`).
- Each pull request should include: summary of changes, testing evidence (`npm run test:functional`, manual vault checks), and references to planning notes or issues.
- Screenshots or GIFs are encouraged when UI output changes (heatmap, settings tab).

## Security & Configuration Tips
- No secrets should live in this repo; vault fixtures contain only test data.
- Keep dependencies up to date; run `npm audit` periodically and document any ignored advisories.
