# ExposureTrade - TradeBrigade Daily Levels

NinjaTrader Web custom indicator, JavaScript.

Draws a horizontal line at each price in the list at the top of the code, for marking the day's TradeBrigade levels. Each line runs the full width of the chart, with its price labelled next to the price scale, placed the same way as the Daily Levels labels. Out of the box the lines are cyan and 2 px thick.

## Entering Levels

The levels go in the code. The NinjaTrader Web settings dialog doesn't show text settings, so it has no box to paste a list into. An earlier version declared one with `predef.paramSpecs.text`, and the dialog showed every other setting but left that one out.

Each day:

1. Open **Code Explorer** and select the indicator.
2. Near the top, replace the prices between the quotes on the `LEVELS` line:

   ```js
   const LEVELS = "29000, 28840, 28652, 28490, 28240, 28043, 27616";
   ```

3. Save. If the chart still shows the old lines, remove the indicator from the chart and add it again.

Rules for the list:

- Separate prices with commas. Semicolons and spaces also work, and blank entries are skipped.
- Keep the whole list on one line, between the two quotes.
- A price entered twice is drawn once.
- The label shows each price exactly as you typed it, so `6080.50` stays `6080.50`.
- Anything that isn't a number, such as `60x0`, is skipped and listed in a note at the top of the chart (`TradeBrigade levels: not a price: 60x0`), so a typo doesn't silently drop a level.
- Use a dot for decimals. A comma always starts a new level, so `6045,25` is read as two levels, 6045 and 25.

## Drawing

Each level is one Graphics API line with `infiniteStart` and `infiniteEnd` set, drawn once from the last bar, the same approach working community level indicators use. Lines outside the visible price range are simply off screen. They don't make the chart rescale, since the indicator has no plots.

Labels are pinned to the right edge of the plot area with `origin: { cs: "grid", h: "right", v: "top" }` and sit just above their line, against the price scale, as in Daily Levels. They use the line colour.

## Settings

| Setting | Default | Description |
|---|---|---|
| Level Colour | `#00ffff` (cyan) | Line and label colour. |
| Line Width | 2 | Line thickness in pixels. |
| Line Style | Solid | Solid, Dotted, Dashed, Wide dash or Fine dash. |
| Show Labels | on | Shows each price next to the price scale. |

The dialog also shows the platform's own Line Styles, Input, Add As and Shift rows. These come from the platform, and the indicator doesn't read them.

All levels share one colour, width and style. Every copy of the indicator on a chart reads the same `LEVELS` list, so for a second group of levels in another colour, save a second indicator in Code Explorer with its own list and a different `name` and `description` in `module.exports`.

## Installation

1. In NinjaTrader Web, open **Code Explorer**.
2. Create a new indicator and replace its contents with `tradebrigade-levels.js`.
3. Put the day's levels on the `LEVELS` line, save, then add **ExposureTrade - TradeBrigade Daily Levels** to a chart.

If it doesn't appear in the indicator list, switch to the older web version. The newer interface has been failing to list custom indicators.

## Limitations

- **Levels are edited in code**, because the settings dialog doesn't show text settings.
- **Overlapping labels** when two levels are within a few ticks of each other.
- **Testing.** Tested with stand-in platform modules: parsing (separators, blanks, repeats, unreadable entries, negative and small prices), the line and label graphics, every setting, and drawing only from the last bar. The file passes JSHint 2.5 to 2.13 with no warnings. The settings dialog was checked on a live NinjaTrader Web chart, but the lines haven't been seen on one yet.
