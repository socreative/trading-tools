/*
 * ExposureTrade - TradeBrigade Daily Levels - NinjaTrader Web custom indicator
 *
 * Draws a horizontal line at each of up to 7 prices typed into the settings,
 * one price per box (level1 ... level7). Each box has its own on/off switch
 * (showLevel1 ... showLevel7), and a box left at 0 draws nothing. Each line runs
 * the full width of the chart, with its price labelled next to the price scale.
 *
 * One box per price because the NinjaTrader Web settings dialog doesn't show text
 * settings, and a number box holds a single number, so a comma-separated list
 * can't be typed into either.
 *
 * Written without for...of loops: the Code Explorer editor reports them as
 * syntax errors.
 */

const predef = require("./tools/predef");
const { du, px } = require("./tools/graphics");

// Prices the 7 boxes start with when the indicator is added to a chart. 0 means empty.
const DEFAULT_LEVELS = [29000, 28840, 28652, 28490, 28240, 28043, 27616];

// Line style choices, mapped to the platform's DashLineStyle values (same as Daily Levels).
const LINE_STYLES = {
    solid: { label: "Solid", dash: 1 },           // Solid
    dotted: { label: "Dotted", dash: 3 },         // TwoTwo
    dashed: { label: "Dashed", dash: 4 },         // FiveTwo
    dashedWide: { label: "Wide dash", dash: 5 },  // FourFour
    dashedTight: { label: "Fine dash", dash: 2 }  // ThreeOne
};

function lineStyleParam(def) {
    const options = {};
    Object.keys(LINE_STYLES).forEach(key => {
        options[key] = LINE_STYLES[key].label;
    });
    return predef.paramSpecs.enum(options, def);
}

// The prices from the boxes that are switched on and not empty, in box order, without repeats.
function activeLevels(props) {
    const levels = [];
    const seen = {};
    DEFAULT_LEVELS.forEach((def, i) => {
        const n = i + 1;
        if (!props["showLevel" + n]) {
            return;
        }
        const price = Number(props["level" + n]);
        if (!isFinite(price) || price <= 0 || seen[price]) {
            return;
        }
        seen[price] = true;
        levels.push({ slot: n, price });
    });
    return levels;
}

class tradeBrigadeLevels {
    init() {
        this.levels = activeLevels(this.props);
    }

    map(d) {
        // The lines span the whole chart, so they only need drawing once, from the last bar.
        // If the platform doesn't say which bar is last, draw on every bar: global items
        // with the same keys replace each other.
        const last = typeof d.isLast === "function" ? d.isLast() : true;
        if (!last) {
            return {};
        }
        const items = this.drawLevels();
        return items.length ? { graphics: { items } } : {};
    }

    drawLevels() {
        const p = this.props;
        const style = LINE_STYLES[p.lineStyle] || LINE_STYLES.solid;
        const items = [];

        this.levels.forEach(level => {
            items.push({
                tag: "LineSegments",
                key: "line-" + level.slot,
                lines: [{
                    tag: "Line",
                    a: { x: du(0), y: du(level.price) },
                    b: { x: du(1), y: du(level.price) },
                    infiniteStart: true,
                    infiniteEnd: true
                }],
                lineStyle: {
                    lineWidth: p.lineWidth,
                    color: p.levelColour,
                    lineStyle: style.dash
                },
                global: true
            });
            if (p.showLabels) {
                items.push({
                    tag: "Text",
                    key: "label-" + level.slot,
                    // Same placement as Daily Levels: against the price scale, just above the line.
                    origin: { cs: "grid", h: "right", v: "top" },
                    point: { x: px(0), y: du(level.price) },
                    text: String(level.price),
                    style: { fontSize: 11, fontWeight: "bold", fill: p.levelColour },
                    textAlignment: "leftAbove",
                    global: true
                });
            }
        });
        return items;
    }
}

// level1, showLevel1, level2, showLevel2 ... so each box sits next to its switch,
// followed by the style settings shared by all the lines.
const params = {};
DEFAULT_LEVELS.forEach((def, i) => {
    const n = i + 1;
    params["level" + n] = predef.paramSpecs.number(def, 0.01, 0);
    params["showLevel" + n] = predef.paramSpecs.bool(true);
});
params.levelColour = predef.paramSpecs.color("#00ffff");
params.lineWidth = predef.paramSpecs.number(2, 1, 1);
params.lineStyle = lineStyleParam("solid");
params.showLabels = predef.paramSpecs.bool(true);

module.exports = {
    name: "exposureTradeTradeBrigadeLevels",
    description: "ExposureTrade - TradeBrigade Daily Levels",
    calculator: tradeBrigadeLevels,
    params,
    tags: ["My Indicators"]
};
