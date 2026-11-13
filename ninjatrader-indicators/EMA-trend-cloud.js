/*
 * EMA Trend Cloud - NinjaTrader Web custom indicator
 *
 * Plots a fast and a slow EMA and fills the area between them:
 *   - Cross Up Color while the fast EMA is above the slow EMA (after a cross up)
 *   - Cross Down Color while the fast EMA is below the slow EMA (after a cross down)
 *
 * The fill is drawn by a custom canvas plotter as one full-width vertical band
 * per bar, running from the fast EMA to the slow EMA.
 */

const predef = require("./tools/predef");
const EMA = require("./tools/EMA");
const p = require("./tools/plotting");

class emaTrendCloud {
    init() {
        this.fastEma = EMA(this.props.fastPeriod);
        this.slowEma = EMA(this.props.slowPeriod);
    }

    map(d, i) {
        const value = d.value();
        const fast = this.fastEma(value);
        const slow = this.slowEma(value);

        // Same warm-up as the built-in EMA: hide each line until it has a full period of data.
        const result = {};
        if (i >= this.props.fastPeriod) {
            result.fast = fast;
        }
        if (i >= this.props.slowPeriod) {
            result.slow = slow;
        }
        return result;
    }
}

function cloudPlotter(canvas, indicator, history) {
    const { crossUpColor, crossDownColor, cloudOpacity } = indicator.props;
    const opacity = cloudOpacity / 100;
    if (opacity <= 0) {
        return;
    }

    for (let i = 0; i < history.data.length; ++i) {
        const item = history.get(i);
        // Skip warm-up bars, and bars where the EMAs are equal (a zero-height band).
        if (!item || item.fast === undefined || item.slow === undefined || item.fast === item.slow) {
            continue;
        }

        const x = p.x.get(item);
        canvas.drawLine(
            p.offset(x, item.fast),
            p.offset(x, item.slow),
            {
                color: item.fast > item.slow ? crossUpColor : crossDownColor,
                relativeWidth: 1.0,
                opacity
            }
        );
    }
}

module.exports = {
    name: "emaTrendCloud",
    description: "EMA Trend Cloud",
    calculator: emaTrendCloud,
    params: {
        fastPeriod: predef.paramSpecs.period(9),
        slowPeriod: predef.paramSpecs.period(21),
        crossUpColor: predef.paramSpecs.color("#22c55e"),
        crossDownColor: predef.paramSpecs.color("#ef4444"),
        cloudOpacity: predef.paramSpecs.percent(25, 5, 0, 100)
    },
    tags: ["My Indicators", predef.tags.MovingAverage],
    plots: {
        fast: { title: "Fast EMA" },
        slow: { title: "Slow EMA" }
    },
    // The cloud is listed first so the EMA lines draw on top of it.
    plotter: [
        predef.plotters.custom(cloudPlotter),
        predef.plotters.multiline(["fast", "slow"])
    ],
    schemeStyles: {
        dark: {
            fast: predef.styles.plot({ color: "#38bdf8", lineWidth: 2 }),
            slow: predef.styles.plot({ color: "#f59e0b", lineWidth: 2 })
        },
        light: {
            fast: predef.styles.plot({ color: "#0284c7", lineWidth: 2 }),
            slow: predef.styles.plot({ color: "#d97706", lineWidth: 2 })
        }
    }
};
