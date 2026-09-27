# FreeTube Apple Captions

Word-timed captions and an Apple-inspired interface for [FreeTube](https://github.com/FreeTubeApp/FreeTube).

Captions are the focus: up to three words on screen, added as their timestamps arrive. Short utterances can stay at one or two words, and words from the next utterance do not appear early. Lingering captions clear within three seconds of the last word's timestamp, or earlier when the cue ends.

The interface adds custom window controls, light and dark themes, and a caption settings panel with font, size, placement, color, outline, and background controls. Settings and imported fonts persist between sessions.

## Requirements

- Linux with Flatpak and an X11 or XWayland session.
- FreeTube installed from Flathub. Tested with **0.25.3 Beta**.
- Node.js 18.17 or later and npm.
- Fontconfig (`fc-list`) for the font picker.

This is a customization project for the Linux Flatpak build, rather than a complete copy of the upstream FreeTube source tree. It builds a separate application deployment from your installed FreeTube release. macOS, Windows, and native Wayland are not supported by these build scripts.

## Build and launch

Install FreeTube if it is not already installed:

```sh
flatpak install --user flathub io.freetubeapp.FreeTube
```

From this repository:

```sh
npm ci
npm test
npm run build
./run.sh
```

Quit any existing FreeTube windows before launching this version. FreeTube uses a single application instance, so an existing window may keep running its previous build.

To add a separate application menu entry:

```sh
npm run install:desktop
```

The shortcut is named **FreeTube Apple Captions**. Keep the repository in the same location after installing it, or rerun the command if you move it.

The build reads your installed Flatpak deployment and writes the customized copy to `build/app/`. It leaves the installed upstream files intact. User installations take priority over system installations. Launching checks the source fingerprint and rebuilds when the customizations or upstream deployment change.

## Caption behavior

- Pages contain at most three words. Each word appears at its own timestamp.
- A gap of more than 0.8 seconds between word starts or between cues begins a new page.
- A page clears at its cue boundary or within three seconds of its last word's start, whichever comes first.
- Seeking rebuilds the active page for the new playback position.
- Tracks without individual word timestamps use evenly spaced estimates within each phrase. Exact speech timing depends on the source captions; this project does not analyze audio.
- When the custom renderer cannot read the player's cues, FreeTube's native captions remain available. Native rendering does not provide the custom timing guarantees.

Open FreeTube settings to adjust caption appearance. Themes, presets, and imported fonts are stored in the existing FreeTube profile. Existing settings from earlier versions of this customization are migrated when no newer settings exist.

Apple fonts are not included. Install or import a font you are licensed to use. Missing fonts fall back to Inter, when available, or a system sans-serif font.

## Updates

Update the installed FreeTube Flatpak as usual, then launch with `./run.sh`. The build validates the bundle locations it patches. Future upstream releases can change those locations and require an update to `build.cjs`; compatibility is currently tested only with 0.25.3 Beta.

If a build fails, the previous custom deployment remains in `build/app/`, and the launcher stops with the error. Do not assume the previous runtime is compatible with a newly updated Flatpak runtime. Resolve the build error before launching again.

## Development

```sh
npm test
npm run format:check
```

`src/caption-engine.js` handles timing and word grouping. `src/captions.js` connects it to Shaka Player. `src/ui.js`, `src/apple.css`, and `src/tokens.css` provide the settings panel and appearance. `src/playback-recovery.cjs` preserves progress and coalesces overlapping playback recovery requests. `build.cjs` patches the main process, preload, and renderer bundles.

The automated tests cover caption timing, pauses, seeking, buffer pruning, and playback recovery. Before distributing a build, check window dragging, fullscreen, themes, captions, and settings persistence in the application as well.

## Credits and license

FreeTube is developed by the [FreeTube contributors](https://github.com/FreeTubeApp/FreeTube). This project is licensed under **AGPL-3.0-or-later**, matching FreeTube. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

This project is independent of FreeTube and Apple and is not endorsed by either.
