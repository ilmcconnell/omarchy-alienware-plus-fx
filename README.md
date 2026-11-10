# Alienware FX

An Omarchy 4 shell plugin for fans, lighting and power on Alienware x15 laptops. It is a fork of
[omarchy-alienware](https://github.com/chr0nzz/omarchy-alienware). The fork adds a **Theme** panel to
the Lighting tab, which gives the hardware the theme-matched gradient from
[omarchy-alienfx-plugin](https://github.com/3mrgnc3/omarchy-alienfx-plugin).

## Theme panel

Lighting → Theme (or `H`/`L` until it is selected).

- **Match theme** blends a diagonal gradient from the active Omarchy theme across every key and the
  chassis. It uses the same algorithm as AlienFX, ported to JS in `ThemeFx.js` and checked against
  the Python original in `tests/themefx.test.js`:
  - the near end is the accent
  - the far end is the most distant saturated hue in the theme
  - the two are blended in OkLCh with an S-curve and gamut fitting
- It repaints by itself on `omarchy theme set`, because the plugin watches `theme.generation`.
- **Chassis chips** turn the lid logo, ring top, ring bottom and power button on or off without
  leaving theme mode. Keys `1`-`4` do the same, and `a` toggles them all.
- **Style** is either Gradient or Accent (every light gets the accent). **Direction** is one of
  ↘ ↙ → ↓. **Intensity** runs from -10 to +10. **Key brightness** dims only the keyboard. **Far end**
  is Auto or any colour from the theme. Keyboard shortcuts: `w` swaps the ends, `d` changes the
  direction, `[`/`]` changes the intensity.
- The theme layer never overwrites your own colours. Turn it off and your custom layout comes back.
  Painting a key or region on the other tabs keeps the gradient you see and switches theme mode off.

IPC: `omarchy-shell alienwarefx rgb <theme|theme-off|theme-toggle|chassis-off|chassis-on|axis|intensity> [value]`.


Two parts: a Quickshell plugin that runs unprivileged, and `alienwarectl`, a Go binary that is both
a root D-Bus daemon and a user-side CLI.

- Fan speeds, temperatures, GPU draw and power limits in the bar
- Thermal profiles, CPU turbo, RAPL limits and an additive fan curve
- Chassis RGB, four regions, and per key keyboard lighting
- Follows the Omarchy theme, shows mute state on the mute keys, and restores itself after a suspend

Tested on an Alienware x15 R2. Other models in the family differ, in particular the lighting zone
ids and the keyboard index map.

## Install

The plugin and the helper install separately.

```
omarchy plugin add https://github.com/chr0nzz/omarchy-alienware.git --enable

cd ~/.config/omarchy/plugins/ilm.alienware-fx/packaging/bin
makepkg -si
sudo systemctl enable --now alienwarectl.service
```

Or open the panel and press "Install the helper", which runs the same commands in a terminal so
you can see them before they run.

That installs the prebuilt binary from the latest release. It needs no Go toolchain and takes
seconds. To build from source instead, run `makepkg -si` in `packaging/` rather than
`packaging/bin/`. Both install the same eight files and either can be removed with `pacman -Rns`.

The plugin must be a real directory. The shell's inotify watcher does not follow symlinks, which is
why the package does not ship the plugin itself.

## Update

```
omarchy plugin update ilm.alienware-fx

cd ~/.config/omarchy/plugins/ilm.alienware-fx/packaging/bin
makepkg -si
sudo systemctl restart alienwarectl.service
```

The QML side hot-reloads on save, so a plugin update needs nothing more than `omarchy restart shell`.
The helper does not. Both packages install a published release, never your working tree, so a helper
change is only live once a release exists and you have rebuilt. Check what is actually running with
`alienwarectl version`.

## Uninstall

Blank the lighting first. Removing the package does not turn the leds off, and afterwards there is
nothing left to turn them off with.

```
alienwarectl kbd off
alienwarectl rgb off

sudo systemctl disable --now alienwarectl.service
sudo pacman -Rns omarchy-alienware omarchy-alienware-debug

omarchy plugin remove ilm.alienware-fx
```

The udev rule keeps applying until a reboot, or `sudo udevadm control --reload && sudo udevadm
trigger`. Your saved colours and settings stay behind in
`~/.local/state/omarchy/alienware/state.json`.

## Keybind

Add to `~/.config/hypr/bindings.lua`:

```lua
o.bind("SUPER SHIFT", "A", "Alienware", "omarchy-shell shell summon ilm.alienware-fx '{}'")
```

## If the panel will not close

It takes exclusive keyboard focus while it is open, so a wedged panel can look like a wedged
machine. It is not. Either of these closes it, and neither needs the keyboard focus back:

```
omarchy-shell alienwarefx close
omarchy-shell shell hide ilm.alienware-fx
```

Clicking anywhere outside the panel closes it too, and `esc` closes it unless a text field has
focus, in which case the first `esc` leaves the field and the second closes the panel.

## Docs

| | |
|---|---|
| [Roadmap](docs/roadmap.md) | What works and what is planned |
| [Hardware](docs/hardware.md) | The two lighting controllers, the region map, the privilege model |
| [Behaviour](docs/behaviour.md) | Suspend and resume, mute indicator, thermal profiles, G-Mode |
| [CLI](docs/cli.md) | Every `alienwarectl` verb |
| [Key map](docs/KEYMAP.txt) | The measured keyboard index map |
| [Development](docs/development.md) | Tests and releases |
