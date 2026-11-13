/*
 * ExposureTrade - TradeBrigade Daily Levels - NinjaTrader Web custom indicator
 *
 * Draws a horizontal line at each price in LEVELS below. Each line runs the full
 * width of the chart, with its price labelled next to the price scale.
 *
 * The levels live in the code because the NinjaTrader Web settings dialog doesn't
 * show text settings, so there is nowhere in the settings to paste a list.
 *
 * Written without for...of loops: the Code Explorer editor reports them as
 * syntax errors.
 */

// ===== PASTE THE DAY'S LEVELS BETWEEN THE QUOTES, THEN SAVE =====
// Separate prices with commas. Use a dot for decimals: 6045.25, not 6045,25.
const LEVELS = "29000, 28840, 28652, 28490, 28240, 28043, 27616";
// =================================================================

const predef = require("./tools/predef");
const { du, px } = require("./tools/graphics");

// Line style choices, mapped to the platform's DashLineStyle values (same as Daily Levels).
const LINE_STYLES = {
    solid: { label: "Solid", dash: 1 },           // Solid
    dotted: { label: "Dotted", dash: 3 },         // TwoTwo
    dashed: { label: "Dashed", dash: 4 },         // FiveTwo
    dashedWide: { label: "Wide dash", dash: 5 },  // FourFour
    dashedTight: { label: "Fine dash", dash: 2 }  // ThreeOne
};

const NOTE_POSITION = { x: 260, y: 20 }; // pixels from the top-left of the plot area

function lineStyleParam(def) {
    const options = {};
    Object.keys(LINE_STYLES).forEach(key => {
        options[key] = LINE_STYLES[key].label;
    });
    return predef.paramSpecs.enum(options, def);
}

// "6045.25, 6080; 6112.5" -> levels in the order typed, without repeats, plus anything unreadable.
// Commas, semicolons and spaces all separate entries.
function parseLevels(text) {
    const levels = [];
    const invalid = [];
    const seen = {};
    String(text || "").split(/[,;\s]+/).forEach(token => {
        if (!token) {
            return;
        }
        const price = Number(token);
        if (!isFinite(price)) {
            invalid.push(token);
            return;
        }
        if (!seen[price]) {
            seen[price] = true;
            levels.push({ price, text: token });
        }
    });
    return { levels, invalid };
}

class tradeBrigadeLevels {
    init() {
        const parsed = parseLevels(LEVELS);
        this.levels = parsed.levels;
        this.invalid = parsed.invalid;
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

        this.levels.forEach((level, i) => {
            items.push({
                tag: "LineSegments",
                key: "line-" + i,
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
                    key: "label-" + i,
                    // Same placement as Daily Levels: against the price scale, just above the line.
                    origin: { cs: "grid", h: "right", v: "top" },
                    point: { x: px(0), y: du(level.price) },
                    text: level.text,
                    style: { fontSize: 11, fontWeight: "bold", fill: p.levelColour },
                    textAlignment: "leftAbove",
                    global: true
                });
            }
        });

        if (this.invalid.length) {
            items.push({
                tag: "Text",
                key: "invalid-note",
                origin: { cs: "grid", h: "left", v: "top" },
                point: { x: px(NOTE_POSITION.x), y: px(NOTE_POSITION.y) },
                text: "TradeBrigade levels: not a price: " + this.invalid.join(", "),
                style: { fontSize: 11, fill: p.levelColour },
                textAlignment: "centerBelow",
                global: true
            });
        }
        return items;
    }
}

module.exports = {
    name: "exposureTradeTradeBrigadeLevels",
    description: "ExposureTrade - TradeBrigade Daily Levels",
    calculator: tradeBrigadeLevels,
    params: {
        levelColour: predef.paramSpecs.color("#00ffff"),
        lineWidth: predef.paramSpecs.number(2, 1, 1),
        lineStyle: lineStyleParam("solid"),
        showLabels: predef.paramSpecs.bool(true)
    },
    tags: ["My Indicators"]
};
