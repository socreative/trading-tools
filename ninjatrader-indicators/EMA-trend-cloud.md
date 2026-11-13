# EMA Trend Cloud

NinjaTrader Web custom indicator, JavaScript.

Plots a fast and a slow Exponential Moving Average and fills the space between them. The fill uses the cross-up color while the fast EMA is above the slow one and the cross-down color while it is below. Out of the box that is green after a bullish cross and red after a bearish one, with both colors and the fill opacity set in the indicator's parameters.

## How It Works

### 1. The EMAs

Both lines come from NinjaTrader's own `./tools/EMA` module, the same one the built-in EMA uses, so values match the stock indicator for the same period and input. Each line stays hidden until it has a full period of data, which is also how the built-in EMA behaves.

The input is whatever series the chart passes to the indicator, which is the close on a normal candlestick chart.

### 2. The Cloud

The fill comes from a custom canvas plotter. At each bar it draws a vertical band from the fast EMA to the slow EMA, at full bar width (`relativeWidth: 1.0`) so neighbouring bands meet with no gaps. The bands use the cross-up color where fast > slow and the cross-down color where fast < slow. A bar where the two are exactly equal has a zero-height band and is skipped.

The cloud starts on the first bar where the slower EMA is visible. The plotter list puts the cloud first, so the EMA lines draw on top of it.

### 3. Crossings

Each band is one bar wide, so the color changes on the first bar after the EMAs cross, and the edge of the cloud steps slightly from bar to bar instead of following the lines exactly. At normal zoom levels the steps are hard to see.

An earlier version drew the cloud as filled polygons through the Graphics API, which could switch color exactly at the crossing point. NinjaTrader Web drew the lines but not the polygons, so the cloud now uses the canvas plotter approach, the one community cloud indicators use.

### 4. Live Bars

EMA state is kept in calculator fields, the same pattern NinjaTrader's built-in EMA uses, so the indicator relies on the platform's usual handling of the forming bar. The band on the last bar can switch color intrabar if the EMAs cross and uncross before the bar closes, just like the lines themselves.

## Settings

| Setting | Default | Range | Description |
|---|---|---|---|
| fastPeriod | 9 | 1+ | Period of the fast EMA. |
| slowPeriod | 21 | 1+ | Period of the slow EMA. |
| crossUpColor | `#22c55e` (green) | color | Cloud color while the fast EMA is above the slow EMA. |
| crossDownColor | `#ef4444` (red) | color | Cloud color while the fast EMA is below the slow EMA. |
| cloudOpacity | 25 | 0-100 | Fill opacity in percent. 0 turns the cloud off and leaves just the lines. |

Line color, width and style for **Fast EMA** and **Slow EMA** are in the indicator's style section, like any other plot. Defaults are light blue and amber at 2px on the dark theme, and darker shades of the same on the light theme.

The cloud colors follow fast versus slow by name. If you set `fastPeriod` higher than `slowPeriod`, the "fast" line becomes the slower one and the colors read the other way round.

## Installation

1. In NinjaTrader Web, open **Code Explorer**.
2. Create a new indicator file and replace its contents with `EMA-trend-cloud.js`.
3. Save it. The indicator appears in the chart's indicator list as **EMA Trend Cloud**, under "My Indicators" and "Moving Averages".
4. Add it to a chart and adjust the periods, colors and opacity in its settings.

## Limitations

- The newer NinjaTrader Web interface may not list custom indicators at all, whether created in Code Explorer or installed from the community. The indicator showed up after switching to the older web version. Other users have reported the same problem on the Tradovate forum, with no official fix.
- If it still doesn't appear, search for its display name, **EMA Trend Cloud**, not the file name, and check the browser console for a red error.
- The cloud color changes on the first bar after a cross rather than at the exact crossing point (see Crossings above).
- The color inputs use `predef.paramSpecs.color()`, the same helper NinjaTrader's own examples and community cloud indicators use.
