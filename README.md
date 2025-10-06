# Obsidian Habit Button

This plugin lets you track your habits in a single tap. Features like streaks and heatmaps will help you staying motivated, while grace and warning periods will allow you to stay flexible within your timeline.

You can drop in your habit buttons anywhere including Canvas. To not lose the focus on lots of habits, there are groups that provide a quick status.

## Demo

### Habit Button

- render a tap-to-log habit card with streak, heatmap, and overdue hints
- supports per-block icons, grace periods, and granular layouts

![Habit button demo](assets/habit-button-demo.gif)

### Habit Group

- aggregate multiple habits into a summarized status bar
- highlight streak health with ordered emerald/amber/gray segments

### Canvas Mashup

- mix and match buttons and groups on an Obsidian Canvas for quick daily reviews

![Canvas demo](assets/canvas-demo.png)

## Installation

To use the plugin simply install it from the marketplace.

## Usage

### Habit Button block

Use a fenced code block with language `habit-button`:

```markdown
\`\`\`habit-button
title: Morning Stretch
icon: ☀️
gracePeriodHours: 24
warningWindowHours: 6
heatLayout: row
border: true
\`\`\`
```

Key properties:

- `title` *(required)* — label shown on the card; also used to derive the habit key.
- `gracePeriodHours` *(default 24)* — hours allowed before the streak resets.
- `warningWindowHours` *(default 24)* — hours that keep the streak active but mark it as at-risk (amber stripes).
- `heatLayout` — `grid` or `row`. Combine with `weeks`, `days`, and size options for fine-tuning.
- `border`, `icon`, `group`, and other advanced options inherit sensible defaults from plugin settings.

### Habit Group block

Summarize related habits with a `habit-group` block:

```markdown
\`\`\`habit-group
title: Morning Rituals
group: morning
icon: ☕
habitsLocations:
  - habits/morning.md
  - habits/stretching.md
\`\`\`
```

Groups read live data from the habit registry. When you provide `habitsLocations`, the block eagerly rescans those notes on each render; without it, the group relies on cached registry updates from embedded habit buttons.

### Canvas placement

Drag the rendered blocks onto a Canvas or embed them via copy/paste. The plugin keeps stats in sync, so the Canvas view updates automatically when you mark a habit done elsewhere.

## Features

- **One-tap logging with history-aware streaks** — click the button to append a timestamped entry, update the streak, and repaint the heatmap instantly.

  ![Habit button logging](assets/canvas-demo.png)

- **Adaptive warnings and styled progress** — warning windows render amber striped segments, while active habits stay emerald and inactive habits gray.

  ![Streak warnings](assets/canvas-demo.png)

- **Habit groups with sortable segments** — see emerald (healthy), amber (warning), and gray (stalled) habits aligned in a single progress bar and aggregate counter.

  ![Group summary](assets/canvas-demo.png)

- **Canvas-ready layout** — combine multiple cards and groups into dashboards, drag them around, and keep everything synchronized with your vault data.

  ![Canvas layout](assets/canvas-demo.png)
