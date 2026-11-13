# ExposureTrade - TradeBrigade Daily Levels

NinjaTrader Web custom indicator, JavaScript.

Draws a horizontal line at each of up to 7 prices typed into its settings, for marking the day's TradeBrigade levels. Each line runs the full width of the chart, with its price labelled next to the price scale, placed the same way as the Daily Levels labels. Out of the box the lines are cyan and 2 px thick.

## Entering Levels

The settings have 7 price boxes, **Level 1** to **Level 7**, each followed by a **Show Level** checkbox. Each day, type the new prices into the boxes and save.

- Untick a level's checkbox to hide its line without losing the price.
- Set a box to 0 to leave it empty. Use this when the day has fewer than 7 levels.
- A price entered in two boxes is drawn once.
- Labels show whole numbers without decimals (`28043`) and keep real decimals (`6045.25`).

The boxes start with `29000, 28840, 28652, 28490, 28240, 28043, 27616` when the indicator is added to a chart. To change those starting prices, edit `DEFAULT_LEVELS` near the top of the code, or set the boxes and tick **Save As Default** in the settings dialog.

### Why not one box with a comma-separated list

NinjaTrader Web has no settings type that takes a typed list:

- **Text settings aren't shown.** An earlier version declared a text setting with `predef.paramSpecs.text` for the list. The settings dialog showed every other setting but left that one out.
- **A number box holds one number.** The platform passes the indicator a number, so commas never reach the code. Joining the prices into one long number doesn't work either, since JavaScript numbers lose precision after about 15 digits.

## Drawing

Each level is one Graphics API line with `infiniteStart` and `infiniteEnd` set, drawn once from the last bar, the same approach working community level indicators use. Lines outside the visible price range are simply off screen. They don't make the chart rescale, since the indicator has no plots.

Labels are pinned to the right edge of the plot area with `origin: { cs: "grid", h: "right", v: "top" }` and sit just above their line, against the price scale, as in Daily Levels. They use the line colour.

## Settings

| Setting | Default | Description |
|---|---|---|
| Level 1 ... Level 7 | 29000, 28840, 28652, 28490, 28240, 28043, 27616 | Price for each line. 0 means empty. |
| Show Level 1 ... Show Level 7 | on | Draws that level's line and label. |
| Level Colour | `#00ffff` (cyan) | Line and label colour. |
| Line Width | 2 | Line thickness in pixels. |
| Line Style | Solid | Solid, Dotted, Dashed, Wide dash or Fine dash. |
| Show Labels | on | Shows each price next to the price scale. |

The dialog also shows the platform's own Line Styles, Input, Add As and Shift rows. These come from the platform, and the indicator doesn't read them.

All levels share one colour, width and style. Add the indicator to the chart a second time for another group of up to 7 levels in a different colour.

## Installation

1. In NinjaTrader Web, open **Code Explorer**.
2. Create a new indicator and replace its contents with `tradebrigade-levels.js`.
3. Save it, then add **ExposureTrade - TradeBrigade Daily Levels** to a chart and enter your levels in its settings.

If you already had the earlier version on a chart, remove it and add it again so the dialog picks up the new settings.

If it doesn't appear in the indicator list, switch to the older web version. The newer interface has been failing to list custom indicators.

## Limitations

- **7 levels per copy.** Add a second copy for more.
- **Overlapping labels** when two levels are within a few ticks of each other.
- **Testing.** Tested with stand-in platform modules: the setting order and defaults, each checkbox, empty, cleared and repeated boxes, decimal prices, the line and label graphics, every style setting, and drawing only from the last bar. The file passes JSHint 2.5 to 2.13 with no warnings. The number boxes haven't been seen in the live settings dialog yet, and the lines haven't been seen on a live chart.
