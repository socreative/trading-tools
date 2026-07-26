# ExposureTrade - Multi SMA (Daily)

TradingView indicator, Pine Script v6.

A Pine Script v6 indicator that plots up to 5 Simple Moving Averages, all calculated on **1-day** data no matter what timeframe the chart is on. It behaves like TradingView's built-in Simple Moving Average with its Timeframe field set to 1 day, except that one copy of the indicator covers five lengths instead of one.

The daily timeframe is a constant in the code rather than an input, so it cannot be changed by accident:

```pine
SMA_TF = "1D"
```

## How It Works

### 1. Data Source

Each SMA is fetched with `request.security(syminfo.tickerid, "1D", ta.sma(source, length))`, using the default `lookahead=barmerge.lookahead_off` and no historical offset. That gives the same behaviour as the built-in SMA on a daily timeframe:

- **Historical bars** show the value of the last *closed* daily bar. No future data leaks into the past.
- **The current day** updates live, so on a 5-minute chart the line moves as today's price moves.

The consequence of that combination is worth knowing: today's live value settles to a slightly different number once the day closes, so the most recent segment of the line shifts once per day. This is how the standard SMA behaves too. If you need a value that never changes after the fact, use the closed-day value from the previous session instead.

Five `request.security()` calls are used, well within the 40-request limit.

### 2. Chart Timeframes at 1 Day and Above

Requesting daily data from a weekly or monthly chart returns whichever daily value happened to land at the higher-timeframe close, which is not useful. So when the chart timeframe is daily or higher, the SMA is calculated locally on the chart's own bars instead:

```pine
useLocal = timeframe.in_seconds(timeframe.period) >= timeframe.in_seconds(SMA_TF)
```

On a daily chart both paths produce identical numbers. On a weekly chart you get a genuine weekly SMA rather than a broken daily one, and the labels name the timeframe in use, e.g. `SMA 200 (1W)`.

### 3. Source Handling

`input.source` returns a chart series such as `close` or `hl2`. Pine re-evaluates that series inside the requested context, so `close` becomes the *daily* close. Picking another indicator's plot as the source is possible in the dropdown but cannot be re-evaluated on the daily timeframe, so stick to the built-in price sources.

### 4. Appearance

Color, thickness and line style are plot properties, so the **Style** tab owns them, the same way it does for the built-in Simple Moving Average. There are five plots, `SMA 1` through `SMA 5`, matching the five input groups.

The `color` and `linewidth` values in the code are defaults only. TradingView remembers whatever the user sets in the Style tab and applies it on top. That only holds while the script passes a plain constant: a color derived from an input is reapplied on every bar and silently overrides the Style tab, which is why neither is wired to an input here.

Defaults out of the box:

| Plot | Default length | Default color | Default thickness |
|---|---|---|---|
| SMA 1 | 20 | blue | 1 |
| SMA 2 | 50 | orange | 1 |
| SMA 3 | 100 | purple | 2 |
| SMA 4 | 200 | red | 2 |
| SMA 5 | 10 (off) | aqua | 1 |

### 5. Labels

With **Show labels on last bar** enabled, each visible SMA gets a label at the right edge of the chart reading e.g. `SMA 200 (1D)  4312.50`. Labels are deleted and redrawn on the last bar, so only one set ever exists.

Label text uses `chart.fg_color`, so it follows the light or dark theme. It does not match the line color, because a script cannot read the colors chosen in the Style tab. The length in the label text is what identifies the line.

Labels sit at the SMA's own price, so two SMAs at nearly the same value will overlap. Turn labels off, or shorten them by reducing **Label size**, if that gets in the way.

### 6. Where Each Setting Lives

The split follows what TradingView already does well:

- **Inputs tab** - what each SMA calculates: on/off, length, source, offset. Plus the label settings.
- **Style tab** - what each SMA looks like: color, thickness, line style, visibility.

Nothing appears in both places, so there are no dead controls and no setting that silently overrides another.

The one overlap worth knowing: the Style tab's visibility checkbox hides the line but leaves that SMA's label, because the script cannot see the checkbox state. Use the **Show** toggle in the Inputs tab to remove both.

### 7. Status Line

TradingView appends the value of every input and every plot to the indicator name in the chart status line. Left alone that produces a line reading `ExposureTrade - Multi SMA (Daily) 5 Small 20 close 0 50 close 0 ...`.

So the status line is curated:

- Every input except the five lengths is `display=display.none`.
- The five length inputs are `display=display.status_line`.
- The SMA plots omit `display.status_line`, keeping `display.pane + display.price_scale + display.data_window`.

The status line therefore reads:

```
ExposureTrade - Multi SMA (Daily)  20 50 100 200 10
```

Values are still available from the price scale, the data window and the right-edge labels.

Input visibility is static, so a length appears in the status line whether or not its SMA is enabled. SMA 5 ships disabled, so its `10` shows by default. Set `len5` to `display=display.none` if you would rather see only the four active lengths.

## Settings

### Inputs tab, Global

| Setting | Default | Range | Description |
|---|---|---|---|
| Show labels on last bar | on | on/off | Draws a price label at the right edge for each visible SMA. |
| Label offset (bars) | 5 | 0-100 | How far right of the last bar the labels sit. |
| Label size | Small | Tiny / Small / Normal | Text size of the labels. |

### Inputs tab, per SMA (5 identical groups)

| Setting | SMA 1 | SMA 2 | SMA 3 | SMA 4 | SMA 5 | Description |
|---|---|---|---|---|---|---|
| Show | on | on | on | on | off | Hides the line and its label when off. |
| Length | 20 | 50 | 100 | 200 | 10 | SMA period in **days**, 1-5000. |
| Source | close | close | close | close | close | Price source, evaluated on the daily bar. |
| Offset | 0 | 0 | 0 | 0 | 0 | Shifts the line left or right by this many bars, -500 to 500. |

### Style tab

Five entries, `SMA 1` through `SMA 5`, each with TradingView's standard plot controls: visibility, color and opacity, thickness, and line style where the chart offers it. These are not duplicated in the Inputs tab.

## Usage Tips

- **Intraday trading (1m to 4h):** This is the point of the indicator. The daily 50 and 200 stay put on the chart while you work a lower timeframe, so you can see where price sits relative to the levels that swing traders are watching.
- **Length is in days.** A length of 200 is the daily 200 SMA even on a 1-minute chart, not 200 minutes.
- **Distinguishing the lines:** in the Style tab, give the longer SMAs a heavier thickness, or dial back the opacity of the shorter ones, so the important levels read first.
- **Adding a fifth level:** SMA 5 ships disabled with a length of 10 as a spare slot. Common uses are the daily 10, 21 or 500.
- **Weekly and monthly charts:** the lines switch to the chart's own timeframe, since daily SMAs cannot be drawn meaningfully there. Check the label suffix to see which timeframe you are looking at.

## Installation

1. Open TradingView and navigate to the Pine Editor (bottom panel).
2. Click "Open" > "New blank indicator".
3. Delete any existing code and paste the contents of `multi-sma-daily.pine`.
4. Click "Save" and give it a name.
5. Click "Add to chart".
