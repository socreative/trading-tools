# ExposureTrade - Multi SMA (Daily)

NinjaTrader Web custom indicator, JavaScript. Port of the TradingView indicator [`multi-sma-daily.pine`](../tradingview-indicators/multi-sma-daily.pine).

Plots up to 5 Simple Moving Averages calculated on **daily** data on any chart timeframe, so the daily 20, 50, 100 and 200 stay on the chart while you trade a 5-minute chart. Defaults match the Pine version: lengths 20, 50, 100 and 200 switched on, plus a spare slot at 10 switched off. Optional labels just right of the last bar name each SMA and show its current value.

## The Big Difference: History

The Pine version asks TradingView for daily bars with `request.security()`. NinjaTrader Web indicators can't do that: they only see the bars on the chart they're added to. On an intraday chart the indicator therefore builds its own daily bars out of the chart's bars, which means:

**A 200-day SMA needs 200 trading days of intraday history loaded on the chart.**

How far back NinjaTrader Web loads intraday data depends on the platform and your data plan. Older Tradovate community posts mention about two months of minute data, while daily charts go back years. If that still holds, the 20-day and probably the 50-day SMA will work on a 5-minute chart, and the 100 and 200 will not.

When an SMA doesn't have enough history, the indicator doesn't draw a partial average. It leaves that line off and shows a note at the top of the chart, such as:

```
Multi SMA: not enough history for SMA 100, 200 (chart has 42 days)
```

The note also tells you exactly how much history your chart has. On a daily chart there is no such problem, since every bar is already a day.

In practice a 5-minute chart on NinjaTrader Web had only **10 days** loaded, too few for even the 20-day SMA. For that case each SMA takes a typed-in value. See [Manual Values](#manual-values).

## How It Works

### 1. Daily Bars From the Chart

On intraday charts (minute, tick, range, volume and similar bars), bars are grouped into trading days. A trading day starts at **dayStart**, New York time (18:00 by default), like CME futures sessions. Sunday evening's bars belong to Monday. Daylight saving is handled, using the same conversion as Daily Levels.

Each day's open, high, low and close come from its bars: the open of the first bar, the highest high, the lowest low and the close of the latest bar.

The chart's first day usually starts partway through a session, so its open, high and low would be wrong. It is left out unless the chart's first bar opens within 5 minutes of **dayStart**.

### 2. Today's Value

**includeToday** controls how the day in progress is treated:

- **On (default):** each bar's SMA is the last *length - 1* completed days plus today's price so far. The line moves with price during the day, and the value at the right edge matches the live value TradingView shows for the Pine version.
- **Off:** each bar's SMA uses only completed days, so the line is flat all day and steps once at the rollover. This matches how the Pine version draws past days, and the value never changes after the fact.

Neither setting matches the Pine version exactly, because Pine draws past days stepped and today live. NinjaTrader Web keeps each bar's value once it is drawn, so one rule has to apply to every day.

### 3. Daily and Longer Charts

On daily charts, each chart bar is one day and the SMA is a plain average of the chart bars, like the built-in SMA. **includeToday** and **dayStart** are ignored. This matches the Pine version's behaviour on daily-and-above charts.

On multi-day bars the SMA is calculated on those bars, and the labels name the bar size, for example `SMA 20 (7D)`. Whether NinjaTrader Web reports weekly bars as 7-day bars has not been checked.

### 4. Sources

Each SMA has a **Source**: Close, Open, High, Low, (H+L)/2, (H+L+C)/3, (O+H+L+C)/4 or (H+L+C+C)/4. The source is applied to the *daily* bar, so High means the daily high, as in the Pine version.

### 5. Appearance

Line color, width and style are in the indicator's style section as **SMA 1** to **SMA 5**, like any other plot. The defaults copy the Pine version:

| Plot | Length | Color | Width | On |
|---|---|---|---|---|
| SMA 1 | 20 | blue | 1 | yes |
| SMA 2 | 50 | orange | 1 | yes |
| SMA 3 | 100 | purple | 2 | yes |
| SMA 4 | 200 | red | 2 | yes |
| SMA 5 | 10 | aqua | 1 | no |

### 6. Labels

With **showLabels** on, each visible SMA gets a label reading `SMA 200 (1D)  4312.50`, starting **labelOffset** pixels right of the last bar at the SMA's price. Values are shown to the contract's tick precision.

The indicator can't read the colors chosen in the style section, so all labels share **labelColor** (grey by default, readable on both themes). The length in the text tells the lines apart. Labels sit at their SMA's price, so two SMAs at nearly the same value will overlap.

### 7. Live Bars

Every running value (the day's open, high, low and close, and the completed-day sums) is stored per bar and built from the previous bar's stored value. Recalculating the forming bar on every tick gives the same result as calculating it once.

## Manual Values

When the chart doesn't have enough history to calculate an SMA, you can type in its value: **sma1Manual** to **sma5Manual**, 0 (the default) meaning off. The indicator then draws that SMA as a flat line at your value across the current trading day, with a label such as `SMA 200 (1D manual)  20500.25`.

- **Only today.** Past days on the chart are left blank, because a flat line there would show a value the SMA never had. The indicator uses your computer's clock to tell which trading day is current, since it calculates past bars first. At weekends it uses Friday's session.
- **Calculated values win.** If the chart has enough history for an SMA, the manual value is ignored. Daily charts always calculate.
- **Style and Data Box.** The manual line is the normal SMA plot, so the colors and widths in the style section apply, and the Data Box shows the value.

**Where to get the values:** add this indicator to a daily chart, where all five SMAs calculate, and copy the numbers from its labels. Enter them once a day, after the 17:00 ET close and before your next session, so they match the latest completed day.

**How close is a flat line?** A daily SMA moves during the day by today's price change divided by its length, so the 200-day SMA moves 1/200 of the day's move. A flat line for the day is also how TradingView draws the daily SMA on past intraday days.

**Update them every trading day.** The indicator can't tell whether a value is current. Whatever you entered stays in the settings and is drawn on each new trading day until you change it, so yesterday's value will show up as today's if you forget. The `manual` in the label is the reminder.

## Differences From the TradingView Version

| | TradingView | NinjaTrader Web |
|---|---|---|
| Daily data | Requested from TradingView's daily bars | Built from the chart's own bars (see History) |
| Past days on intraday charts | Stepped, closed-day values | Moving with price (default) or stepped (`includeToday` off) |
| Offset | Per SMA | Not available: the platform's plot shift is fixed in code, not a setting |
| Label position | Bars right of the last bar | Pixels right of the last bar |
| Label size | Tiny / Small / Normal | Same |
| Status line | Shows the five lengths | NinjaTrader Web has no equivalent |
| Missing history | Not an issue | Note at the top of the chart, or manual values for today |

## Settings

| Setting | Default | Description |
|---|---|---|
| includeToday | on | Include today's price in each day's SMA (moves with price). Off uses completed days only (steps once a day). Intraday charts only. |
| dayStart | 1800 | When a trading day starts, New York time, HHMM. Intraday charts only. |
| showLabels | on | Labels right of the last bar with each SMA's length and value. |
| labelOffset | 8 | Gap between the last bar and the labels, in pixels. |
| labelSize | Small | Tiny, Small or Normal. |
| labelColor | `#9ca3af` (grey) | Label and history-note color. |
| showHistoryNote | on | Shows the note at the top of the chart when an SMA lacks history. |
| sma1Show ... sma5Show | on, on, on, on, off | Turns each SMA (line and label) on or off. |
| sma1Length ... sma5Length | 20, 50, 100, 200, 10 | SMA period in **days**. |
| sma1Source ... sma5Source | Close | Price taken from each daily bar. |
| sma1Manual ... sma5Manual | 0 (off) | Today's daily SMA value, drawn when the chart lacks the history to calculate it. See Manual Values. |

## Usage Tips

- **Check the note first.** If an SMA you expect is missing, the note says how many days the chart has. Load more history if your platform allows it, or enter manual values copied from a daily chart.
- **Length is in days.** A length of 200 is the daily 200 SMA even on a 1-minute chart.
- **Spare slot.** SMA 5 ships switched off at length 10. Common uses are the daily 10, 21 or 500.
- **Non-CME hours.** For a product whose trading day starts at a different time, set `dayStart` to its session start. For calendar days, set it to `0`.

## Installation

1. In NinjaTrader Web, open **Code Explorer**.
2. Create a new indicator and replace its contents with `multi-sma-daily.js`.
3. Save it, then add **ExposureTrade - Multi SMA (Daily)** to a chart. It is listed under "My Indicators" and "Moving Averages".

If it doesn't appear in the indicator list, switch to the older web version. The newer interface has been failing to list custom indicators.

## Limitations

- **History** limits which SMAs can be drawn on intraday charts. See above.
- **Values can differ slightly from TradingView.** The daily close here is the last trade of the session from the chart's bars. TradingView can use the exchange settlement price as the daily close for futures. TradingView's continuous contracts (such as `ES1!`) also stitch contract months together differently from a NinjaTrader Web chart, so expect differences across a roll.
- **No offset.** See the comparison table.
- **Testing.** Tested with synthetic 5-minute and 60-minute bars on the CME schedule across the November 2026 DST change, plus synthetic daily and 7-day bars. Every SMA value matched an independent calculation on every bar, for all eight sources, both `includeToday` settings, the partial first day and custom day starts. Feeding every bar four tick updates gave exactly the same output as one update. A year of 5-minute bars took under 100 ms. Manual values were tested on a 10-day chart with the clock set to a weekday, Saturday, Sunday before and after the 18:00 open, and a day earlier than the last bar: each time they covered exactly the current trading day's bars. The lines, labels and history note have not yet been checked on a live NinjaTrader Web chart.
