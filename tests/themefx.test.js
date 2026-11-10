const test = require("node:test")
const assert = require("node:assert/strict")
const { Model, ThemeFx } = require("./load.js")

const TOKYO = [
  "accent\t#7aa2f7", "foreground\t#a9b1d6", "background\t#1a1b26",
  "red\t#f7768e", "yellow\t#e0af68", "green\t#9ece6a", "cyan\t#449dab",
  "blue\t#7aa2f7", "magenta\t#ad8ee6", "selection\t#292e42", "muted\t#414868",
  "bright_red\t#ff7a93", "bright_yellow\t#ff9e64", "bright_green\t#b9f27c",
  "bright_cyan\t#0db9d7", "bright_blue\t#7da6ff", "bright_magenta\t#bb9af7"
].join("\n")

const rgb = (hex) => ThemeFx.toRgb(hex)
const hex = (c) => ThemeFx.toHex(c)

test("parity: end colours match alienfx-ctl palette.anchors on Tokyo Night", () => {
  const pal = ThemeFx.paletteMap(TOKYO)
  const primary = ThemeFx.primaryOf(pal)
  assert.equal(primary.name, "accent")
  assert.equal(hex(primary.rgb), "7AA2F7")
  const far = ThemeFx.autoSecondary(pal, primary.rgb)
  assert.equal(far.name, "yellow")
  assert.equal(hex(far.rgb), "E0AF68")
})

test("parity: intensity shaping matches alienfx-ctl apply_intensity", () => {
  const cases = { "-10": ["94B4F7", "E0BB86"], "0": ["2568F7", "E09222"], "7": ["0B57F7", "E0890A"], "10": ["004FF7", "E08500"] }
  for (const k of Object.keys(cases)) {
    assert.deepEqual([hex(ThemeFx.shape(rgb("7AA2F7"), Number(k), 100)), hex(ThemeFx.shape(rgb("E0AF68"), Number(k), 100))], cases[k], "intensity " + k)
  }
  assert.equal(hex(ThemeFx.shape(rgb("7AA2F7"), 0, 40)), "0F2A63")
})

test("parity: OkLCh blend matches alienfx-ctl lerp_perceptual", () => {
  const expected = { 0: "2568F7", 0.1: "2568F7", 0.25: "2D67F7", 0.5: "D854A5", 0.6: "EC7A3F", 0.75: "E19123", 0.9: "E09222", 1: "E09222" }
  for (const t of Object.keys(expected)) {
    assert.equal(hex(ThemeFx.lerpPerceptual(rgb("2568F7"), rgb("E09222"), Number(t))), expected[t], "t=" + t)
  }
  assert.equal(hex(ThemeFx.lerpPerceptual([255, 0, 0], [128, 128, 128], 0.4)), "F03729")
  assert.equal(hex(ThemeFx.lerpPerceptual([255, 40, 0], [0, 200, 180], 0.5)), "A8A200")
})

test("parity: a near monochrome theme synthesises a complement", () => {
  const pal = { accent: [138, 133, 136], foreground: [200, 200, 200] }
  const primary = ThemeFx.primaryOf(pal)
  const far = ThemeFx.autoSecondary(pal, primary.rgb)
  assert.equal(far.name, "complement")
  assert.equal(hex(far.rgb), "5A8A6D")
})

test("primaryOf falls back through bright_blue, blue, foreground", () => {
  assert.equal(ThemeFx.primaryOf({ blue: [1, 2, 3], foreground: [4, 5, 6] }).name, "blue")
  assert.equal(ThemeFx.primaryOf({ foreground: [4, 5, 6] }).name, "foreground")
  assert.equal(ThemeFx.primaryOf({}), null)
})

test("intensitySaturation spans 0.40, 0.85, 1.00", () => {
  assert.equal(ThemeFx.intensitySaturation(-10), 0.40)
  assert.equal(ThemeFx.intensitySaturation(0), 0.85)
  assert.equal(ThemeFx.intensitySaturation(10), 1.00)
  assert.equal(ThemeFx.intensitySaturation(99), 1.00)
})

test("setSaturation leaves near greys alone", () => {
  assert.deepEqual(ThemeFx.setSaturation([138, 133, 136], 1), [138, 133, 136])
})

test("easeBlend is exact at the ends and symmetric", () => {
  assert.equal(ThemeFx.easeBlend(0), 0)
  assert.equal(ThemeFx.easeBlend(1), 1)
  assert.ok(Math.abs(ThemeFx.easeBlend(0.5) - 0.5) < 1e-12)
})

test("sampleAxis corners", () => {
  assert.equal(ThemeFx.sampleAxis(0, 0, "tl-br"), 0)
  assert.equal(ThemeFx.sampleAxis(1, 1, "tl-br"), 1)
  assert.equal(ThemeFx.sampleAxis(1, 0, "tr-bl"), 1)
  assert.equal(ThemeFx.sampleAxis(0.3, 0.7, "lr"), 0.7)
  assert.equal(ThemeFx.sampleAxis(0.3, 0.7, "tb"), 0.3)
  assert.equal(ThemeFx.sampleAxis(0.3, 0.7, "bogus"), 0.5)
})

test("extreme keys: esc is near and the right arrow is far on the default diagonal", () => {
  assert.deepEqual(ThemeFx.extremeKeys("tl-br"), { near: "esc", far: "right" })
})

test("every paintable key gets a gradient colour, endpoints byte exact", () => {
  const p = ThemeFx.plan(TOKYO, {})
  assert.equal(p.ok, true)
  assert.deepEqual(Object.keys(p.keys).sort(), Model.keyboardPaintableIds().slice().sort())
  assert.equal(p.keys.esc, p.near)
  assert.equal(p.near, "2568F7")
  assert.equal(p.far, "E09222")
})

test("chassis: logo and ring top take the near corner, power and ring bottom the far", () => {
  const p = ThemeFx.plan(TOKYO, {})
  assert.equal(p.regions.logo, p.regions["ring-top"])
  assert.equal(p.regions.power, p.regions["ring-bottom"])
  assert.equal(p.regions.logo, "2568F7")
  assert.notEqual(p.regions.logo, p.regions.power)
})

test("keyboard brightness dims keys but never the chassis", () => {
  const full = ThemeFx.plan(TOKYO, { brightness: 100 })
  const dim = ThemeFx.plan(TOKYO, { brightness: 20 })
  assert.notEqual(full.keys.esc, dim.keys.esc)
  assert.deepEqual(full.regions, dim.regions)
})

test("swap and far override change the ends", () => {
  const swapped = ThemeFx.plan(TOKYO, { swap: true })
  assert.equal(swapped.nearName, "yellow")
  assert.equal(swapped.farName, "accent")
  const pinned = ThemeFx.plan(TOKYO, { far: "magenta" })
  assert.equal(pinned.farName, "magenta")
  const unknown = ThemeFx.plan(TOKYO, { far: "nope" })
  assert.equal(unknown.farName, "yellow")
})

test("accent style fills every key with one colour", () => {
  const p = ThemeFx.plan(TOKYO, { style: "accent" })
  const values = new Set(Object.values(p.keys))
  assert.equal(values.size, 1)
  assert.equal(new Set(Object.values(p.regions)).size, 1)
})

test("a chassis region switched off stays dark in theme mode", () => {
  const p = ThemeFx.plan(TOKYO, {})
  const eff = Model.effectiveRegionColors(p.regions, { power: true, logo: false, "ring-top": true, "ring-bottom": false })
  assert.equal(eff.logo, "000000")
  assert.equal(eff["ring-bottom"], "000000")
  assert.equal(eff.power, p.regions.power)
})

test("empty palette yields an empty plan", () => {
  const p = ThemeFx.plan("", {})
  assert.equal(p.ok, false)
  assert.deepEqual(p.keys, {})
})

test("ribbon samples run from near to far", () => {
  const r = ThemeFx.ribbon("2568F7", "E09222", 12)
  assert.equal(r.length, 12)
  assert.equal(r[0].color, "#2568F7")
  assert.equal(r[11].color, "#E09222")
})

test("farChoices lists saturated palette colours once", () => {
  const ids = ThemeFx.farChoices(TOKYO).map((c) => c.id)
  assert.ok(ids.includes("yellow"))
  assert.ok(!ids.includes("selection"))
  assert.equal(new Set(ids).size, ids.length)
})

test("nextAxis cycles both ways", () => {
  assert.equal(ThemeFx.nextAxis("tl-br", 1), "tr-bl")
  assert.equal(ThemeFx.nextAxis("tl-br", -1), "tb")
})

test("intensityLabel is signed", () => {
  assert.equal(ThemeFx.intensityLabel(0), "0")
  assert.equal(ThemeFx.intensityLabel(3), "+3")
  assert.equal(ThemeFx.intensityLabel(-2), "-2")
})

test("state round trips the theme settings and defaults old files", () => {
  const old = Model.parseState(JSON.stringify({ version: 2, themeSync: true }))
  assert.deepEqual(old.theme, { style: "gradient", axis: "tl-br", intensity: 0, brightness: 100, swap: false, far: "", regions: { power: "", logo: "", "ring-top": "", "ring-bottom": "" } })
  const theme = { style: "accent", axis: "lr", intensity: -4, brightness: 35, swap: true, far: "magenta", regions: { power: "FF0040", logo: "", "ring-top": "00FF00", "ring-bottom": "" } }
  const saved = Model.buildStatePayload({ theme: theme, themeSync: true })
  assert.deepEqual(Model.parseState(JSON.stringify(saved)).theme, theme)
  const bad = Model.normalizeThemeSettings({ style: "x", axis: "y", intensity: 99, brightness: -5, far: "<img>", power: "nothex" })
  assert.deepEqual(bad, { style: "gradient", axis: "tl-br", intensity: 10, brightness: 0, swap: false, far: "", regions: { power: "", logo: "", "ring-top": "", "ring-bottom": "" } })
  assert.equal(Model.normalizeThemeSettings({ power: "#abc" }).regions.power, "AABBCC")
})

test("custom chassis colours override only their own light", () => {
  const base = ThemeFx.plan(TOKYO, {})
  const custom = ThemeFx.plan(TOKYO, { regions: { power: "#ff0040", "ring-top": "00ff00" } })
  assert.equal(custom.regions.power, "FF0040")
  assert.equal(custom.regions["ring-top"], "00FF00")
  assert.equal(custom.custom.power, true)
  assert.equal(custom.custom.logo, false)
  assert.equal(custom.themeRegions.power, base.regions.power)
  assert.deepEqual(custom.keys, base.keys)
  for (const id of ["logo", "ring-bottom"]) assert.equal(custom.regions[id], base.regions[id])
  assert.equal(ThemeFx.plan(TOKYO, { style: "accent", regions: { logo: "00FF00" } }).regions.logo, "00FF00")
  assert.equal(ThemeFx.plan(TOKYO, { regions: { logo: "bogus" } }).custom.logo, false)
  assert.equal(ThemeFx.plan(TOKYO, { power: "123456" }).regions.power, "123456")
})
