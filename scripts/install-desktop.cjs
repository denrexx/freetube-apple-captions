const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const launcher = path.resolve(__dirname, '..', 'run.sh')
const escape = (value) => value.replace(/[\\"`$]/g, '\\$&')
const applications = path.join(
  process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local/share'),
  'applications',
)
fs.mkdirSync(applications, { recursive: true })
const destination = path.join(applications, 'io.freetubeapp.FreeTube.AppleCaptions.desktop')
fs.writeFileSync(
  destination,
  `[Desktop Entry]
Name=FreeTube Apple Captions
Comment=Word-timed captions and an Apple-inspired interface for FreeTube
Exec="${escape(launcher)}" %u
Icon=io.freetubeapp.FreeTube
Type=Application
Terminal=false
StartupNotify=true
StartupWMClass=FreeTube
Categories=AudioVideo;
MimeType=x-scheme-handler/freetube;
`,
)
console.log(`Installed application shortcut: ${destination}`)
