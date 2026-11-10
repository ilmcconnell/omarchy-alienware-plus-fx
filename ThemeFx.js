.pragma library
.import "Model.js" as Model

var AXES = ["tl-br", "tr-bl", "lr", "tb"]
var DEFAULT_AXIS = "tl-br"
var STYLES = ["gradient", "accent"]
var DEFAULT_STYLE = "gradient"

var PRIMARY_KEYS = ["accent", "bright_blue", "blue", "foreground"]
var SECONDARY_CANDIDATES = [
  "cyan", "magenta", "blue", "green", "red", "yellow",
  "bright_cyan", "bright_magenta", "bright_blue",
  "bright_green", "bright_red", "bright_yellow",
  "selection", "muted"
]
var FAR_CHOICES = ["red", "orange", "yellow", "green", "cyan", "blue", "magenta", "bright_red", "bright_green", "bright_cyan", "bright_magenta"]

var INTENSITY_RANGE = 10
var INTENSITY_FLOOR = 0.40
var INTENSITY_MIDDLE = 0.85
var INTENSITY_CEILING = 1.00
var HUE_NOISE_FLOOR = 0.08
var SECONDARY_MIN_SAT = 0.15
var SECONDARY_MIN_DISTANCE = 0.06
var BLEND_HOLD = 4.5
var CHROMA_EPSILON = 1e-4
var GAMUT_SLACK = 5e-4
var MEDIA_GUTTER = 1.2

var NEAR_REGIONS = ["logo", "ring-top"]
var FAR_REGIONS = ["ring-bottom", "power"]

function pyRound(x) {
  var r = Math.round(x)
  if (Math.abs(x % 1) === 0.5 && r % 2 !== 0) r -= 1
  return r
}

function pyMod(a, n) {
  return ((a % n) + n) % n
}

function clampByte(v) {
  var n = pyRound(Number(v))
  if (isNaN(n)) return 0
  return Math.max(0, Math.min(255, n))
}

function toRgb(hex) {
  var c = Model.hexToRgb(hex)
  return c ? [c.r, c.g, c.b] : null
}

function toHex(rgb) {
  var out = ""
  for (var i = 0; i < 3; i++) out += ("0" + clampByte(rgb[i]).toString(16)).slice(-2)
  return out.toUpperCase()
}

function rgbToHsv(r, g, b) {
  var maxc = Math.max(r, g, b)
  var minc = Math.min(r, g, b)
  var v = maxc
  if (minc === maxc) return [0, 0, v]
  var range = maxc - minc
  var s = range / maxc
  var rc = (maxc - r) / range
  var gc = (maxc - g) / range
  var bc = (maxc - b) / range
  var h
  if (r === maxc) h = bc - gc
  else if (g === maxc) h = 2.0 + rc - bc
  else h = 4.0 + gc - rc
  return [pyMod(h / 6.0, 1.0), s, v]
}

function hsvToRgb(h, s, v) {
  if (s === 0) return [v, v, v]
  var i = Math.floor(h * 6.0)
  var f = h * 6.0 - i
  var p = v * (1.0 - s)
  var q = v * (1.0 - s * f)
  var t = v * (1.0 - s * (1.0 - f))
  i = pyMod(i, 6)
  if (i === 0) return [v, t, p]
  if (i === 1) return [q, v, p]
  if (i === 2) return [p, v, t]
  if (i === 3) return [p, q, v]
  if (i === 4) return [t, p, v]
  return [v, p, q]
}

function hsvOf(rgb) {
  return rgbToHsv(clampByte(rgb[0]) / 255, clampByte(rgb[1]) / 255, clampByte(rgb[2]) / 255)
}

function fromHsv(h, s, v) {
  var c = hsvToRgb(h, s, v)
  return [pyRound(c[0] * 255), pyRound(c[1] * 255), pyRound(c[2] * 255)]
}

function hueDistance(a, b) {
  var delta = pyMod(Math.abs(hsvOf(a)[0] - hsvOf(b)[0]), 1.0)
  return Math.min(delta, 1.0 - delta)
}

function paletteMap(text) {
  var parsed = Model.parseThemePalette(text)
  var out = {}
  for (var k in parsed.map) out[k.toLowerCase()] = toRgb(parsed.map[k])
  return out
}

function primaryOf(palette) {
  for (var i = 0; i < PRIMARY_KEYS.length; i++) {
    if (palette[PRIMARY_KEYS[i]]) return { name: PRIMARY_KEYS[i], rgb: palette[PRIMARY_KEYS[i]] }
  }
  for (var k in palette) return { name: k, rgb: palette[k] }
  return null
}

function autoSecondary(palette, primary) {
  var best = null
  var bestName = ""
  var bestDistance = -1
  for (var i = 0; i < SECONDARY_CANDIDATES.length; i++) {
    var key = SECONDARY_CANDIDATES[i]
    var candidate = palette[key]
    if (!candidate) continue
    if (hsvOf(candidate)[1] < SECONDARY_MIN_SAT) continue
    var distance = hueDistance(primary, candidate)
    if (distance > bestDistance) {
      best = candidate
      bestName = key
      bestDistance = distance
    }
  }
  if (best === null || bestDistance < SECONDARY_MIN_DISTANCE) {
    var hsv = hsvOf(primary)
    return { name: "complement", rgb: fromHsv(pyMod(hsv[0] + 0.5, 1.0), Math.max(hsv[1], 0.35), hsv[2]) }
  }
  return { name: bestName, rgb: best }
}

function intensitySaturation(intensity) {
  var steps = Math.max(-INTENSITY_RANGE, Math.min(INTENSITY_RANGE, Math.trunc(Number(intensity) || 0)))
  var fraction = Math.abs(steps) / INTENSITY_RANGE
  if (steps >= 0) return INTENSITY_MIDDLE + (INTENSITY_CEILING - INTENSITY_MIDDLE) * fraction
  return INTENSITY_MIDDLE - (INTENSITY_MIDDLE - INTENSITY_FLOOR) * fraction
}

function setSaturation(rgb, target) {
  var hsv = hsvOf(rgb)
  if (hsv[1] < HUE_NOISE_FLOOR) return [clampByte(rgb[0]), clampByte(rgb[1]), clampByte(rgb[2])]
  return fromHsv(hsv[0], Math.max(0, Math.min(1, target)), hsv[2])
}

function percentToByte(percent) {
  var p = Math.max(0, Math.min(100, Number(percent)))
  if (isNaN(p)) p = 100
  return clampByte(p * 255 / 100)
}

function scale(rgb, brightness) {
  var factor = clampByte(brightness) / 255.0
  return [pyRound(clampByte(rgb[0]) * factor), pyRound(clampByte(rgb[1]) * factor), pyRound(clampByte(rgb[2]) * factor)]
}

function shape(rgb, intensity, brightnessPercent) {
  return scale(setSaturation(rgb, intensitySaturation(intensity)), percentToByte(brightnessPercent))
}

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function linearToSrgb(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055
}

function cbrt(v) {
  return v < 0 ? -Math.pow(-v, 1.0 / 3.0) : Math.pow(v, 1.0 / 3.0)
}

function rgbToOklab(rgb) {
  var r = srgbToLinear(clampByte(rgb[0]) / 255.0)
  var g = srgbToLinear(clampByte(rgb[1]) / 255.0)
  var b = srgbToLinear(clampByte(rgb[2]) / 255.0)
  var l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  var m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  var s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  ]
}

function oklabToLinear(lab) {
  var l = lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2]
  var m = lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2]
  var s = lab[0] - 0.0894841775 * lab[1] - 1.2914855480 * lab[2]
  l = l * l * l
  m = m * m * m
  s = s * s * s
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  ]
}

function oklabToRgb(lab) {
  var lin = oklabToLinear(lab)
  var out = []
  for (var i = 0; i < 3; i++) out.push(clampByte(linearToSrgb(Math.max(0, Math.min(1, lin[i]))) * 255))
  return out
}

function inGamut(lightness, chroma, hue) {
  var lin = oklabToLinear([lightness, chroma * Math.cos(hue), chroma * Math.sin(hue)])
  for (var i = 0; i < 3; i++) if (lin[i] < -GAMUT_SLACK || lin[i] > 1.0 + GAMUT_SLACK) return false
  return true
}

function fitChroma(lightness, chroma, hue) {
  if (inGamut(lightness, chroma, hue)) return chroma
  var low = 0.0
  var high = chroma
  for (var i = 0; i < 20; i++) {
    var middle = (low + high) / 2.0
    if (inGamut(lightness, middle, hue)) low = middle
    else high = middle
  }
  return low
}

function easeBlend(position) {
  if (position <= 0) return 0
  if (position >= 1) return 1
  var held = Math.pow(position, BLEND_HOLD)
  return held / (held + Math.pow(1.0 - position, BLEND_HOLD))
}

function lerpPerceptual(first, second, position) {
  if (position <= 0) return [clampByte(first[0]), clampByte(first[1]), clampByte(first[2])]
  if (position >= 1) return [clampByte(second[0]), clampByte(second[1]), clampByte(second[2])]
  var t = easeBlend(position)
  var a = rgbToOklab(first)
  var b = rgbToOklab(second)
  var nearChroma = Math.hypot(a[1], a[2])
  var farChroma = Math.hypot(b[1], b[2])
  var lightness = a[0] + (b[0] - a[0]) * t
  var chroma = nearChroma + (farChroma - nearChroma) * t
  if (nearChroma < CHROMA_EPSILON && farChroma < CHROMA_EPSILON) return oklabToRgb([lightness, 0, 0])
  var hue
  if (nearChroma < CHROMA_EPSILON) hue = Math.atan2(b[2], b[1])
  else if (farChroma < CHROMA_EPSILON) hue = Math.atan2(a[2], a[1])
  else {
    var nearHue = Math.atan2(a[2], a[1])
    var farHue = Math.atan2(b[2], b[1])
    var delta = pyMod(farHue - nearHue + Math.PI, 2.0 * Math.PI) - Math.PI
    hue = nearHue + delta * t
  }
  chroma = fitChroma(lightness, chroma, hue)
  return oklabToRgb([lightness, chroma * Math.cos(hue), chroma * Math.sin(hue)])
}

function normalizeAxis(axis) {
  var a = String(axis || "")
  return AXES.indexOf(a) >= 0 ? a : DEFAULT_AXIS
}

function normalizeStyle(style) {
  var s = String(style || "")
  return STYLES.indexOf(s) >= 0 ? s : DEFAULT_STYLE
}

function nextAxis(axis, direction) {
  var i = AXES.indexOf(normalizeAxis(axis))
  var step = Number(direction) < 0 ? -1 : 1
  return AXES[pyMod(i + step, AXES.length)]
}

function sampleAxis(rowT, colT, axis) {
  var a = normalizeAxis(axis)
  if (a === "lr") return colT
  if (a === "tb") return rowT
  if (a === "tr-bl") return (rowT + (1.0 - colT)) / 2.0
  return (rowT + colT) / 2.0
}

var keyPositionCache = null

function keyPositions() {
  if (keyPositionCache) return keyPositionCache
  var rows = Model.KEYBOARD_ROWS
  var full = Model.keyboardRowWeight(rows[0])
  var out = []
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r]
    var span = (r === 0 || r === rows.length - 1) ? full : full - MEDIA_GUTTER
    var weight = Model.keyboardRowWeight(row)
    var x = 0
    for (var i = 0; i < row.length; i++) {
      var w = row[i].w * span / weight
      if (Model.isKeyPaintable(row[i])) out.push({ id: row[i].id, row: r, x: x + w / 2 })
      x += w
    }
  }
  var media = Model.KEYBOARD_MEDIA_COLUMN
  for (var m = 0; m < media.length; m++) {
    out.push({ id: media[m].id, row: m + 1, x: full - MEDIA_GUTTER / 2 })
  }
  var minX = Infinity, maxX = -Infinity, maxRow = 0
  for (var j = 0; j < out.length; j++) {
    minX = Math.min(minX, out[j].x)
    maxX = Math.max(maxX, out[j].x)
    maxRow = Math.max(maxRow, out[j].row)
  }
  for (var k = 0; k < out.length; k++) {
    out[k].rowT = maxRow ? out[k].row / maxRow : 0
    out[k].colT = maxX > minX ? (out[k].x - minX) / (maxX - minX) : 0
  }
  keyPositionCache = out
  return out
}

function keyRatios(axis) {
  var pos = keyPositions()
  var out = []
  for (var i = 0; i < pos.length; i++) out.push({ id: pos[i].id, t: sampleAxis(pos[i].rowT, pos[i].colT, axis) })
  return out
}

function extremeKeys(axis) {
  var ratios = keyRatios(axis)
  var near = ratios[0]
  var far = ratios[0]
  for (var i = 1; i < ratios.length; i++) {
    if (ratios[i].t < near.t) near = ratios[i]
    if (ratios[i].t > far.t) far = ratios[i]
  }
  return { near: near.id, far: far.id }
}

function renderKeyboard(near, far, axis) {
  var ratios = keyRatios(axis)
  var out = {}
  for (var i = 0; i < ratios.length; i++) out[ratios[i].id] = toHex(lerpPerceptual(near, far, ratios[i].t))
  return out
}

function keyRatio(axis, id) {
  var ratios = keyRatios(axis)
  for (var i = 0; i < ratios.length; i++) if (ratios[i].id === id) return ratios[i].t
  return 0.5
}

function chassisColors(near, far, axis) {
  var ends = extremeKeys(axis)
  var nearColor = toHex(lerpPerceptual(near, far, keyRatio(axis, ends.near)))
  var farColor = toHex(lerpPerceptual(near, far, keyRatio(axis, ends.far)))
  var out = {}
  for (var i = 0; i < NEAR_REGIONS.length; i++) out[NEAR_REGIONS[i]] = nearColor
  for (var j = 0; j < FAR_REGIONS.length; j++) out[FAR_REGIONS[j]] = farColor
  return out
}

function ribbon(nearHex, farHex, count) {
  var a = toRgb(nearHex)
  var b = toRgb(farHex)
  var n = Math.max(2, Math.trunc(Number(count) || 12))
  var out = []
  if (!a || !b) return out
  for (var i = 0; i < n; i++) {
    var p = i / (n - 1)
    out.push({ position: p, color: "#" + toHex(lerpPerceptual(a, b, p)) })
  }
  return out
}

function farChoices(text) {
  var palette = paletteMap(text)
  var out = []
  var seen = {}
  for (var i = 0; i < FAR_CHOICES.length; i++) {
    var key = FAR_CHOICES[i]
    var rgb = palette[key]
    if (!rgb) continue
    if (hsvOf(rgb)[1] < SECONDARY_MIN_SAT) continue
    var hex = toHex(rgb)
    if (seen[hex]) continue
    seen[hex] = true
    out.push({ id: key, label: Model.capitalizeLabel(key.replace("bright_", "bright ")), hex: hex })
  }
  return out
}

function emptyPlan() {
  return { ok: false, style: DEFAULT_STYLE, axis: DEFAULT_AXIS, near: "", far: "", nearName: "", farName: "", rawNear: "", rawFar: "", keys: {}, regions: {}, themeRegions: {}, custom: {} }
}

function plan(text, opts) {
  var o = opts || {}
  var palette = paletteMap(text)
  var primary = primaryOf(palette)
  var out = emptyPlan()
  out.style = normalizeStyle(o.style)
  out.axis = normalizeAxis(o.axis)
  if (!primary) return out
  var accentOverride = toRgb(o.accent)
  if (accentOverride && !palette.accent) primary = { name: "accent", rgb: accentOverride }
  var secondary = null
  var farKey = String(o.far || "")
  if (farKey && palette[farKey]) secondary = { name: farKey, rgb: palette[farKey] }
  else secondary = autoSecondary(palette, primary.rgb)
  var ends = [primary, secondary]
  if (o.swap === true) ends = [secondary, primary]
  var intensity = o.intensity === undefined ? 0 : o.intensity
  var brightness = o.brightness === undefined ? 100 : o.brightness
  var near = shape(ends[0].rgb, intensity, brightness)
  var far = shape(ends[1].rgb, intensity, brightness)
  out.ok = true
  out.nearName = ends[0].name
  out.farName = ends[1].name
  out.rawNear = toHex(ends[0].rgb)
  out.rawFar = toHex(ends[1].rgb)
  out.near = toHex(near)
  out.far = toHex(far)
  if (out.style === "accent") {
    var solidKeys = {}
    var ids = Model.keyboardPaintableIds()
    for (var i = 0; i < ids.length; i++) solidKeys[ids[i]] = out.near
    var solidRegions = {}
    var rids = Model.regionIds()
    var chassisSolid = toHex(shape(ends[0].rgb, intensity, 100))
    for (var j = 0; j < rids.length; j++) solidRegions[rids[j]] = chassisSolid
    out.far = out.near
    out.farName = out.nearName
    out.keys = solidKeys
    out.regions = solidRegions
    return withOverrides(out, o.regions, o.power)
  }
  out.keys = renderKeyboard(near, far, out.axis)
  out.regions = chassisColors(shape(ends[0].rgb, intensity, 100), shape(ends[1].rgb, intensity, 100), out.axis)
  return withOverrides(out, o.regions, o.power)
}

function withOverrides(out, overrides, legacyPower) {
  var src = overrides && typeof overrides === "object" ? overrides : {}
  var ids = Model.regionIds()
  out.themeRegions = {}
  out.custom = {}
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i]
    out.themeRegions[id] = out.regions[id] || ""
    var hex = Model.normalizeHex(src[id] !== undefined ? src[id] : (id === "power" ? legacyPower : ""))
    out.custom[id] = hex !== ""
    if (hex) out.regions[id] = hex
  }
  return out
}

function intensityLabel(value) {
  var n = Math.round(Number(value) || 0)
  if (n === 0) return "0"
  return (n > 0 ? "+" : "") + n
}

function axisGlyph(axis) {
  var a = normalizeAxis(axis)
  if (a === "tr-bl") return "↙"
  if (a === "lr") return "→"
  if (a === "tb") return "↓"
  return "↘"
}

function prettyName(name) {
  var s = String(name || "")
  if (!s) return ""
  return Model.capitalizeLabel(s.replace(/_/g, " "))
}
