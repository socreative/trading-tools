# S/R Zones (1H) - TradingView Indicator

A Pine Script v6 indicator that automatically identifies and draws support and resistance zones derived from 1-hour chart data. Zones are displayed as colored boxes on the chart and adapt dynamically as price action evolves.

## How It Works

### 1. Data Source

The indicator uses `request.security()` to fetch 1-hour OHLCV data regardless of your current chart timeframe. This means the support/resistance zones are always based on the 1H structure, even if you're viewing a 5-minute or daily chart.

### 2. Pivot Detection

Pivot highs and pivot lows are identified on the 1H data using `ta.pivothigh()` and `ta.pivotlow()` with a configurable lookback length (default: 5 bars). A pivot high is a bar whose high is greater than the highs of the surrounding bars (left and right). A pivot low is the inverse.

- **Pivot High** = potential resistance level
- **Pivot Low** = potential support level

The pivot is confirmed only after `pivotLen` bars have passed to the right, so detection is delayed by that many bars.

### 3. Zone Creation and Merging

When a new pivot is detected, the indicator checks whether it falls within an existing zone. Two levels are considered "near" each other if they are within `zoneWidthPct * 2` percent of each other.

- **If a nearby zone exists:** The zone's level is updated to the average of the old level and the new pivot. The touch count is incremented and the zone's timestamp is refreshed.
- **If no nearby zone exists:** A new zone is created with 1 touch.

This merging behavior causes zones to strengthen over time as price repeatedly tests the same area, and the zone level gradually adjusts to reflect the cluster of pivots.

### 4. Broken Zone Removal

On every bar, the indicator checks whether any zones have been decisively broken:

- A **support zone is removed** if the 1H close drops below the zone level by more than `zoneWidthPct * 2` percent.
- A **resistance zone is removed** if the 1H close rises above the zone level by more than `zoneWidthPct * 2` percent.

Removal iterates in reverse order to safely modify the arrays during traversal.

### 5. Zone Trimming

If the number of zones exceeds `maxZones`, the weakest zones are removed. Zones are scored by:

```
score = (touch_count * 1000) + (bars_since_last_touch)
```

The zone with the lowest score (fewest touches and oldest) is removed first. This keeps the most relevant, frequently-tested zones on the chart.

### 6. Drawing

Zones are drawn only on the last bar (`barstate.islast`) as colored rectangular boxes:

- **Green boxes** = support zones
- **Red boxes** = resistance zones

Each box spans from `extendBars` bars to the left of the current bar to 20 bars to the right. The box height is determined by `zoneWidthPct` above and below the zone level. Only zones with at least `minTouches` touches are drawn.

Each box displays a label showing the number of touches (e.g., "3 touches").

All previous boxes are cleared and redrawn on each update to reflect the current state.

### 7. Alerts

Two alert conditions are available:

- **"Near Support Zone"** - fires when the 1H close is within `zoneWidthPct` percent of a confirmed support level.
- **"Near Resistance Zone"** - fires when the 1H close is within `zoneWidthPct` percent of a confirmed resistance level.

To use these, create an alert in TradingView and select the corresponding condition from this indicator.

### 8. Info Table

A small table in the top-right corner of the chart displays the current count of tracked support and resistance zones (including those below the `minTouches` display threshold).

## Settings

| Setting | Default | Range | Description |
|---|---|---|---|
| Pivot Lookback Length | 5 | 2-20 | Number of bars on each side required to confirm a pivot point. Higher values find fewer, more significant pivots. |
| Zone Width (%) | 0.3 | 0.05-2.0 | Half-width of each zone as a percentage of the price level. Controls how thick the boxes appear and how close two pivots must be to merge. |
| Max Zones to Display | 10 | 1-50 | Maximum number of support/resistance zones tracked at once. Excess zones are pruned by relevance. |
| Extend Zone (bars) | 200 | 10-500 | How far to the left each zone box extends from the current bar. |
| Support Zone Color | Green (80% transparent) | Any color | Fill color for support zone boxes. |
| Resistance Zone Color | Red (80% transparent) | Any color | Fill color for resistance zone boxes. |
| Support Border Color | Green (50% transparent) | Any color | Border color for support zone boxes. |
| Resistance Border Color | Red (50% transparent) | Any color | Border color for resistance zone boxes. |
| Min Touches to Confirm Zone | 2 | 1-5 | Minimum number of pivot touches required before a zone is drawn on the chart. Zones with fewer touches are still tracked internally. |

## Usage Tips

- **Lower timeframes (1m, 5m, 15m):** The zones still reflect 1H structure, giving you a higher-timeframe context for intraday trading.
- **Higher timeframes (4H, Daily):** Zones will still be based on 1H pivots, which may produce more granular levels than you'd see on the higher timeframe alone.
- **Increase Pivot Lookback** to find stronger, more widely-spaced levels. Decrease it for more sensitive detection.
- **Increase Min Touches** to filter out weak zones and only show well-tested levels.
- **Decrease Zone Width** for tighter, more precise zones. Increase it for wider zones that capture broader areas of interest.

## Installation

1. Open TradingView and navigate to the Pine Editor (bottom panel).
2. Click "Open" > "New blank indicator".
3. Delete any existing code and paste the contents of `support-resistance-zones.pine`.
4. Click "Save" and give it a name.
5. Click "Add to chart".
