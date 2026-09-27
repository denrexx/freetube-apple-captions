// Reproducible, dependency-free local patch of the installed FreeTube bundle.
const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto'),
  cp = require('child_process')
const base = __dirname
const appId = 'io.freetubeapp.FreeTube'
let installation, deployment
for (const scope of ['--user', '--system']) {
  try {
    deployment = cp
      .execFileSync('flatpak', ['info', scope, '--show-location', appId], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      .trim()
    installation = scope
    break
  } catch {}
}
if (!deployment) throw new Error('Install the FreeTube Flatpak before building.')
const upstreamFiles = path.join(deployment, 'files')
const original = path.join(upstreamFiles, 'freetube/resources/app.asar')
const buildDir = path.join(base, 'build')
fs.mkdirSync(buildDir, { recursive: true })
const source = fs.readFileSync(original)
const header = JSON.parse(source.subarray(16, 16 + source.readUInt32LE(12)).toString())
const dataOffset = 8 + source.readUInt32LE(4)
const read = (n) => {
  let entry = header
  for (const part of n.split('/')) entry = entry.files[part]
  return source
    .subarray(dataOffset + Number(entry.offset), dataOffset + Number(entry.offset) + entry.size)
    .toString()
}
const src = (n) => fs.readFileSync(path.join(base, 'src', n), 'utf8')
const upstreamVersion = JSON.parse(read('package.json')).version
// The launcher rebuilds when the deployment or custom source files change.
const stamp = path.join(buildDir, '.build-input.sha256')
const fingerprint = crypto.createHash('sha256')
for (const [name, content] of [
  ['upstream-deployment', deployment],
  ['upstream-app.asar', source],
  ['build.cjs', fs.readFileSync(__filename)],
  ...[
    'tokens.css',
    'apple.css',
    'caption-engine.js',
    'ui.js',
    'captions.js',
    'playback-recovery.cjs',
  ].map((n) => [`src/${n}`, src(n)]),
])
  fingerprint.update(name).update('\0').update(content).update('\0')
const inputHash = fingerprint.digest('hex')
if (
  process.argv.includes('--if-needed') &&
  fs.existsSync(path.join(buildDir, 'app/freetube/resources/app.asar')) &&
  fs.existsSync(path.join(buildDir, 'metadata.json')) &&
  fs.existsSync(stamp) &&
  fs.readFileSync(stamp, 'utf8').trim() === inputHash
) {
  console.log('Custom FreeTube build is current')
  process.exit(0)
}
let main = read('dist/main.js')
// FreeTube v0.25.3 renamed this local `i` to `s`.  Keep the marker narrow
// enough to fail safely if the upstream window construction changes again.
const marker = 'new e.BrowserWindow({show:s,backgroundColor:a,'
if (main.split(marker).length !== 2)
  throw new Error('Unsupported FreeTube main bundle; original installation is untouched')
main = main.replace(
  marker,
  "new e.BrowserWindow({frame:false,transparent:true,show:s,backgroundColor:'#00000000',",
)
main += `\n;(() => {
  const {ipcMain,BrowserWindow}=require('electron');
  const drags=new WeakMap();
  ipcMain.on('ft-custom-window-drag',(event,phase,point)=>{
    if(!event.senderFrame?.url.startsWith('app://bundle/'))return;
    const win=BrowserWindow.fromWebContents(event.sender);if(!win)return;
    if(phase==='end'){drags.delete(win);return;}
    if(!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x)>32768 || Math.abs(point.y)>32768)return;
    if(win.isMaximized() || win.isFullScreen()){drags.delete(win);return;}
    if(phase==='start'){const [x,y]=win.getPosition();drags.set(win,{x,y,mouseX:point.x,mouseY:point.y});}
    else if(phase==='move'){const start=drags.get(win);if(start)win.setPosition(Math.round(start.x+point.x-start.mouseX),Math.round(start.y+point.y-start.mouseY));}
  });
  ipcMain.on('ft-custom-window-action',(event,action)=>{
    if(!event.senderFrame?.url.startsWith('app://bundle/')) return;
    const win=BrowserWindow.fromWebContents(event.sender); if(!win) return;
    if(action==='close')win.close();
    else if(action==='minimize')win.minimize();
    else if(action==='maximize'){if(win.isFullScreen())win.setFullScreen(false);else if(win.isMaximized())win.unmaximize();else win.maximize();}
  });
  require('electron').app.on('browser-window-created',(_event,win)=>{
    const send=()=>{if(!win.isDestroyed())win.webContents.send('ft-custom-window-state',{fullscreen:win.isFullScreen(),maximized:win.isMaximized()})};
    for(const event of ['enter-full-screen','leave-full-screen','maximize','unmaximize'])win.on(event,send);
    win.webContents.on('did-finish-load',send);
  });
})();\n`
const fonts = [
  ...new Set(
    cp.execFileSync('fc-list', [':', 'family'], { encoding: 'utf8' }).trim().split(/\n|,/),
  ),
].sort()
const css = src('tokens.css') + '\n' + src('apple.css')
const bootstrap = `;(() => {
  const style=document.createElement('style');style.id='ft-apple-design';style.textContent=${JSON.stringify(css)};document.head.append(style);
  window.__ftInstalledFonts=${JSON.stringify(fonts)};
  ${src('caption-engine.js')}
  ${src('ui.js')}
  ${src('captions.js')}
  window.__ftCustomBuild='apple-2';
})();`
let preload = read('dist/preload.js')
preload += `\n;(() => {
  const {contextBridge,ipcRenderer,webFrame}=require('electron/renderer');
  contextBridge.exposeInMainWorld('ftCustom',{
    windowDrag:(phase,point)=>{if(['start','move','end'].includes(phase))ipcRenderer.send('ft-custom-window-drag',phase,point)},
    windowAction:action=>{if(['close','minimize','maximize'].includes(action))ipcRenderer.send('ft-custom-window-action',action)},
    onWindowState:callback=>ipcRenderer.on('ft-custom-window-state',(_event,state)=>callback(state))
  });
  document.addEventListener('DOMContentLoaded',()=>webFrame.executeJavaScript(${JSON.stringify(bootstrap)}).catch(console.error),{once:true});
})();\n`
let renderer = read('dist/renderer.js')
const recoveryStart = renderer.indexOf('async onPlayerReloadRequested(){')
const recoveryEnd = renderer.indexOf(',...My(["updateHistory"', recoveryStart)
if (recoveryStart < 0 || recoveryEnd < 0 || recoveryEnd - recoveryStart > 1000)
  throw new Error('Unsupported playback recovery handler')
renderer =
  renderer.slice(0, recoveryStart) +
  'onPlayerReloadRequested:' +
  require('./src/playback-recovery.cjs').toString() +
  renderer.slice(recoveryEnd)
const replacements = {
  'dist/main.js': Buffer.from(main),
  'dist/preload.js': Buffer.from(preload),
  'dist/renderer.js': Buffer.from(renderer),
}
const chunks = []
let offset = 0
function walk(dir, prefix = '') {
  for (const [name, entry] of Object.entries(dir.files)) {
    const filename = prefix + name
    if (entry.files) {
      walk(entry, filename + '/')
      continue
    }
    if (entry.link || entry.unpacked) continue
    const content =
      replacements[filename] ||
      source.subarray(
        dataOffset + Number(entry.offset),
        dataOffset + Number(entry.offset) + entry.size,
      )
    entry.offset = String(offset)
    entry.size = content.length
    offset += content.length
    chunks.push(content)
    if (replacements[filename] && entry.integrity) {
      const size = entry.integrity.blockSize || 4194304,
        blocks = []
      for (let i = 0; i < content.length; i += size)
        blocks.push(
          crypto
            .createHash('sha256')
            .update(content.subarray(i, i + size))
            .digest('hex'),
        )
      entry.integrity = {
        algorithm: 'SHA256',
        hash: crypto.createHash('sha256').update(content).digest('hex'),
        blockSize: size,
        blocks,
      }
    }
  }
}
walk(header)
const json = Buffer.from(JSON.stringify(header)),
  aligned = (json.length + 3) & ~3
const pickle = Buffer.alloc(8 + aligned)
pickle.writeUInt32LE(4 + aligned, 0)
pickle.writeUInt32LE(json.length, 4)
json.copy(pickle, 8)
const size = Buffer.alloc(8)
size.writeUInt32LE(4, 0)
size.writeUInt32LE(pickle.length, 4)
// Build in a fresh deployment so Electron, resources, and child sandboxes
// always match the installed release. Publish only after patching succeeds.
const staging = path.join(buildDir, `app-staging-${process.pid}`)
fs.cpSync(upstreamFiles, staging, { recursive: true, verbatimSymlinks: true })
const destination = path.join(staging, 'freetube/resources/app.asar')
fs.writeFileSync(destination + '.new', Buffer.concat([size, pickle, ...chunks]))
fs.renameSync(destination + '.new', destination)
const appDir = path.join(buildDir, 'app')
const previous = path.join(buildDir, 'app-previous')
fs.rmSync(previous, { recursive: true, force: true })
if (fs.existsSync(appDir)) fs.renameSync(appDir, previous)
try {
  fs.renameSync(staging, appDir)
} catch (error) {
  if (fs.existsSync(previous)) fs.renameSync(previous, appDir)
  throw error
}
fs.rmSync(previous, { recursive: true, force: true })
fs.writeFileSync(
  path.join(buildDir, 'metadata.json'),
  JSON.stringify({ installation, deployment, version: upstreamVersion }, null, 2) + '\n',
)
fs.writeFileSync(stamp + '.new', `${inputHash}\n`)
fs.renameSync(stamp + '.new', stamp)
console.log('Built FreeTube Apple Captions:', path.join(appDir, 'freetube/resources/app.asar'))
