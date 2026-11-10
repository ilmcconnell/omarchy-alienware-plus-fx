.pragma library

var KEYBOARD = "keyboard"
var CHASSIS = "chassis"
var THEME = "theme"
var SUB_TABS = [KEYBOARD, CHASSIS, THEME]
var DEFAULT_SUB_TAB = KEYBOARD

function normalizeRgbSubTab(raw, kbdPresent) {
  var value = String(raw === undefined || raw === null ? "" : raw).trim().toLowerCase()
  if (value === THEME) return THEME
  if (kbdPresent === false) return CHASSIS
  return value === CHASSIS ? CHASSIS : DEFAULT_SUB_TAB
}
