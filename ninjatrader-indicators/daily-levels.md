# Daily Levels (PDH PDL ONH ONL)

NinjaTrader Web custom indicator, JavaScript.

Draws four horizontal levels that reset every trading day:

| Level | What it is | Typical read |
|---|---|---|
| PDH | Previous trading day's high | Resistance and buy-side liquidity. A clean break above signals continuation, a sweep and rejection can mark a reversal. |
| PDL | Previous trading day's low | Support and sell-side liquidity. A breakdown signals bearish momentum, a sweep and recovery often triggers a bounce. |
| ONH | Overnight high | The overnight ceiling. Watch whether the cash open can break it or gets rejected. |
| ONL | Overnight low | The overnight floor. Holding above it shows bid strength, losing it at the open often sets a bearish tone. |

Each level is a single ray that starts at the bar that set it and runs to the right edge of the chart, with a label showing the level's name and price next to the price scale.

## How It Works

### 1. Time and Trading Days

All session times are New York time, whatever time zone your platform shows. The conversion has US daylight saving built in (second Sunday of March to first Sunday of November), so the sessions stay put across the clock changes.

A trading day starts at the overnight start time on the previous evening, 18:00 ET by default, the same way CME futures sessions run. Sunday evening's bars therefore belong to Monday, and Monday's previous day is Friday.

| Window | Default (ET) | Used for |
|---|---|---|
| Overnight | 18:00 to 09:30 | ONH / ONL |
| Regular hours (RTH) | 09:30 to 16:00 | PDH / PDL (default) |
| Full session | 18:00 to 17:00 | PDH / PDL when set to ETH |

### 2. PDH / PDL

When a new trading day starts at 18:00, the day that just closed becomes the previous day. By default PDH and PDL are its regular-hours high and low. Set **prevDaySession** to *Full session (ETH)* to include the overnight and after-hours bars as well.

A trading day with no regular-hours bars at all, such as a holiday, keeps the earlier PDH and PDL rather than blanking them.

### 3. ONH / ONL

During the overnight session the rays move as price makes new highs and lows, so you can watch them form in the premarket. From the RTH open they stay fixed for the rest of the trading day, then reset at the next overnight start.

### 4. Drawing

Each level is drawn once, from the last bar, as a Graphics API line with `infiniteEnd: true`. It starts at the bar that first reached the level, such as the candle whose wick made the overnight low, and extends past the last bar to the right edge. When a level changes, the ray is replaced rather than redrawn bar by bar, so there are no steps.

Labels are pinned to the right edge of the plot area with `origin: { cs: "grid", h: "right", v: "top" }` and sit just above their line, against the price scale. The price is rounded to the nearest whole point, e.g. `ONL 28243`, so a level at 28243.75 reads `28244`. The exact value is in the Data Box.

Only the current levels are drawn. Earlier days' levels are not kept on the chart.

The Data Box lists PDH, PDL, ONH and ONL for the bar under the cursor, as they stood at that bar.

## Settings

The settings dialog shows them in this order, one group per row:

| Row | Setting | Default | Description |
|---|---|---|---|
| 1 | prevDaySession | Regular hours (RTH) | Which part of the previous day PDH/PDL come from: RTH or the full session. |
| 1 | rthStart | 930 | Regular-hours open, New York time, as HHMM. |
| 1 | rthEnd | 1600 | Regular-hours close, New York time, as HHMM. |
| 1 | overnightStart | 1800 | Overnight session start and trading-day rollover, New York time, as HHMM. |
| 2 | pdh / pdl / onh / onl LevelColour | grey `#868686` | Color of each level's ray and label. |
| 3 | pdh / pdl / onh / onl LineWidth | 1 | Thickness of each ray in pixels, 1 or more. |
| 4 | pdh / pdl / onh / onl LineStyle | Wide dash | Dash pattern of each ray (see below). |
| 5 | showPrevDay | on | Shows PDH and PDL. |
| 5 | showOvernight | on | Shows ONH and ONL. |
| 5 | showLabels | on | Shows the name and price of each level at the right edge. |

Times are entered as numbers in HHMM form, so 09:30 is `930` and 14:30 is `1430`. The defaults suit equity index futures (ES, NQ, YM, RTY). For crude oil, for example, set `rthStart` to `900` and `rthEnd` to `1430`.

### Line Appearance

Each level has its own colour, width and style. **LineStyle** picks one of the platform's dash patterns:

| Option | Pattern (on/off) |
|---|---|
| Solid | continuous |
| Dotted | 2/2 |
| Dashed | 5/2 |
| Wide dash | 4/4 |
| Fine dash | 3/1 |

All four levels default to the same thin grey line with wide-gap dashes, so they stay in the background. The labels tell them apart. Give a pair its own colour or style if you want to tell them apart at a glance.

These live in the indicator's parameters because the rays are graphics, not plots. The style entries for PDH, PDL, ONH and ONL in the style section only color the Data Box values and do not change the rays.

### Settings Layout

NinjaTrader Web lays parameters out left to right and wraps them like CSS floats. The colour swatches are a few pixels shorter than the other fields, so a swatch at the end of a row makes the next field drop underneath it, which leaves gaps and a staircase. The order and the label lengths above are chosen to avoid that:

- The session row is nearly full, so the colours always start a fresh row.
- The colour settings are named `...LevelColour` because the longer label makes four swatches fill a row on their own.
- The style options have short names because a dropdown grows to fit the selected option, and four long ones would not fit on one row.

This was checked with a model of the dialog's layout built from a screenshot. With any dialog width the screenshot allows and any combination of line styles, nothing drops under a swatch. Each group gets a row of its own in 99% of those cases.

## Installation

1. In NinjaTrader Web, open **Code Explorer**.
2. Create a new indicator and replace its contents with `daily-levels.js`.
3. Save it, then add **Daily Levels (PDH PDL ONH ONL)** to a chart.

If it doesn't appear in the indicator list, switch to the older web version. The newer interface has been failing to list custom indicators.

## Limitations

- **Use 30-minute bars or smaller.** Sessions are assigned by bar timestamp, which is assumed to be the bar's open time. A bar that straddles 09:30, like a 1-hour bar stamped 09:00, counts as overnight, so its RTH prices leak into ONH/ONL. Any timeframe that divides evenly into 30 minutes lines up with the open.
- **Intraday charts only.** On daily, weekly or monthly charts the indicator draws nothing.
- **Overlapping labels.** Levels at nearly the same price will have overlapping labels.
- **Testing.** Tested with synthetic 5-minute bars on the CME schedule across the November 2026 DST change. PDH, PDL, ONH and ONL matched an independent calculation on every bar for RTH, ETH and custom session times, and each ray started on the bar that set its level. On NinjaTrader Web, an earlier version's labels rendered, which confirms Graphics API text works there. The rays and the right-edge label position have not yet been checked in the platform.
