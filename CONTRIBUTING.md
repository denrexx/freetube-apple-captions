# Contributing

Keep changes focused and describe the behavior they affect. For caption fixes, include a short cue sample and the playback times that show the problem.

Run `npm test` and `npm run format:check` before opening a pull request. UI changes also need a check in the running FreeTube app. Include screenshots only when they help explain the change, and remove personal information first.

When updating support for a FreeTube release, check the patch markers, rebuild against that release, and verify captions, window controls, themes, fullscreen, and saved settings. Update the tested version in the README.

Do not commit `build/`, application binaries, profiles, videos, font files, or credentials. Contributions are provided under the project's AGPL-3.0-or-later license.
