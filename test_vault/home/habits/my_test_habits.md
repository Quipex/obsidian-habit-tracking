```habit-group
group: morning

# Optional overrides (remove '#' before the property name to apply it):
# title: My habit group
# icon: ☀️
# habitsLocations:
#   - home/habits.md
# border: true # Show card borders
```

```habit-button
title: My habit

# Optional overrides (remove '#' before the property name to apply it):
# heatLayout: grid # "grid" or "row"
group: morning # the name of the habit-group. should match the 'group' property in the habit-group block
icon: ☀️
# weeks: 26 # applies for 'heatLayout: grid' only
# days: 30 # applies for 'heatLayout: row' only
# gracePeriodHours: 24 # How many hours can pass before the streak breaks (warning window is added on top)
# warningWindowHours: 6 # Hours before the break when the flame indicator appears
cellSize: 30 # Pixel size of heatmap cells
cellGap: 10 # Space between heatmap cells
# dotSize: 8 # Pixel size of heatmap dots
# dotGap: 4 # Space between heatmap dots
# border: true # Show card borders
```
