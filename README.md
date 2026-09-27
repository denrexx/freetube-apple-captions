# FreeTube Apple Captions

Apple-inspired design and compact captions for [FreeTube](https://github.com/FreeTubeApp/FreeTube).

- Up to three words per page, revealed at their timestamps. Short phrases can show one or two words.
- New pages after pauses; lingering captions clear within three seconds of the last word's timestamp, or sooner when the cue ends.
- Custom window controls, light and dark themes, and adjustable caption fonts, size, position, colors, outlines, and backgrounds.
- Settings and imported fonts persist between sessions.

## Setup

Requires Linux, Flatpak, X11 or XWayland, Node.js 18.17+, npm, and Fontconfig (`fc-list`). Tested with **FreeTube 0.25.3 Beta**.

```sh
flatpak install --user flathub io.freetubeapp.FreeTube
npm ci
npm run build
./run.sh
```

Quit other FreeTube windows before launching. Add an application menu shortcut with `npm run install:desktop`; rerun it if you move the repository.

The scripts build a separate copy of the installed FreeTube Flatpak in `build/app/` and use your existing profile. User installations take priority over system installations. This repository contains the customizations, not the full upstream source or application binaries.

## Notes

Caption timing depends on the track: phrases without word timestamps are divided evenly, and native captions are used when the custom renderer cannot access cues. Apple fonts are not included; unavailable fonts fall back to Inter or a system font.

`run.sh` rebuilds when source files or the installed FreeTube deployment change. Future releases may require updated patch markers. A failed build stops the launcher and retains the previous deployment.

## Development

```sh
npm test
npm run format:check
```

For caption bugs, include sample cues and playback times. Check UI changes in the running application.

## License

[AGPL-3.0-or-later](LICENSE). See [NOTICE](NOTICE) for upstream credits. Independent of FreeTube and Apple.
