;(() => {
  if (window.__ftAppleUI) return
  window.__ftAppleUI = true
  const key = 'freetube-apple-settings-v2'
  const defaults = {
    size: 88,
    position: 50,
    font: 'Inter',
    weight: 800,
    color: '#ffffff',
    outline: '#000000',
    stroke: 2.5,
    background: 0,
    theme: 'system',
    minimal: false,
    animation: true,
  }
  const clamp = (v, min, max, fallback) =>
    Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fallback
  const color = (v, f) => (/^#[a-f0-9]{6}$/i.test(v) ? v : f)
  function normalize(v) {
    return {
      size: clamp(v.size, 24, 160, 88),
      position: clamp(v.position, 10, 90, 50),
      font: typeof v.font === 'string' ? v.font.slice(0, 100) : 'Inter',
      weight: clamp(v.weight, 700, 900, 800),
      color: color(v.color, '#ffffff'),
      outline: color(v.outline, '#000000'),
      stroke: clamp(v.stroke, 0, 5, 2.5),
      background: clamp(v.background, 0, 100, 0),
      theme: ['light', 'dark', 'system'].includes(v.theme) ? v.theme : 'system',
      minimal: v.minimal === true,
      animation: v.animation !== false,
    }
  }
  const presets = {
    apple: { font: 'Inter', weight: 800, color: '#ffffff', outline: '#000000', stroke: 2.5 },
    simple: { font: 'Arial', weight: 700, color: '#ffffff', outline: '#000000', stroke: 0 },
    purple: { font: 'Trebuchet MS', weight: 900, color: '#a855f7', outline: '#ffffff', stroke: 2 },
    'white-outline': {
      font: 'Trebuchet MS',
      weight: 900,
      color: '#ffffff',
      outline: '#111111',
      stroke: 3,
    },
    'white-tall': {
      font: 'DejaVu Sans Condensed',
      weight: 700,
      color: '#ffffff',
      outline: '#111111',
      stroke: 3,
    },
  }
  let settings
  try {
    const saved = localStorage.getItem(key)
    const legacy = JSON.parse(localStorage.getItem('freetube-custom-caption-settings-v1') || 'null')
    settings = normalize(
      saved
        ? JSON.parse(saved)
        : legacy
          ? {
              ...defaults,
              ...presets[legacy.preset],
              size: legacy.fontSize,
              position: 90 - (legacy.height || 0),
              background: legacy.backgroundOpacity,
              animation: legacy.animation,
            }
          : defaults,
    )
  } catch {
    settings = { ...defaults }
  }
  const root = document.documentElement
  let panel, saveTimer, layoutTimer
  const media = matchMedia('(prefers-color-scheme: dark)')
  function apply() {
    root.dataset.theme =
      settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme
    root.classList.toggle('ft-minimal', settings.minimal)
    root.dataset.captionAnimation = settings.animation ? 'on' : 'off'
    const vars = {
      size: `${settings.size}px`,
      position: `${settings.position}%`,
      font: `${JSON.stringify(settings.font)}, -apple-system, "Inter", system-ui, sans-serif`,
      weight: settings.weight,
      color: settings.color,
      outline: settings.outline,
      stroke: `${settings.stroke}px`,
      bg: settings.background / 100,
    }
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(`--ft-caption-${k}`, v)
  }
  function save() {
    apply()
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => localStorage.setItem(key, JSON.stringify(settings)), 200)
  }
  addEventListener('pagehide', () => localStorage.setItem(key, JSON.stringify(settings)))
  media.addEventListener('change', apply)
  apply()
  const bar = document.createElement('header')
  bar.id = 'ft-titlebar'
  bar.innerHTML =
    '<div class="ft-traffic"><button class="ft-close" aria-label="Close window" title="Close"><span>×</span></button><button class="ft-min" aria-label="Minimize window" title="Minimize"><span>−</span></button><button class="ft-max" aria-label="Maximize or restore window" title="Maximize / restore"><span>+</span></button></div><span>FreeTube · Apple Captions</span>'
  document.body.prepend(bar)
  bar.querySelector('.ft-close').onclick = () => window.ftCustom?.windowAction('close')
  bar.querySelector('.ft-min').onclick = () => window.ftCustom?.windowAction('minimize')
  bar.querySelector('.ft-max').onclick = () => window.ftCustom?.windowAction('maximize')
  bar.ondblclick = (e) => {
    if (!e.target.closest('button')) window.ftCustom?.windowAction('maximize')
  }
  // Pointer capture keeps transparent custom chrome draggable under XWayland.
  bar.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button') || root.classList.contains('ft-maximized'))
      return
    bar.setPointerCapture(e.pointerId)
    window.ftCustom?.windowDrag('start', { x: e.screenX, y: e.screenY })
  })
  bar.addEventListener('pointermove', (e) => {
    if (bar.hasPointerCapture(e.pointerId))
      window.ftCustom?.windowDrag('move', { x: e.screenX, y: e.screenY })
  })
  const endDrag = (e) => {
    if (bar.hasPointerCapture(e.pointerId)) bar.releasePointerCapture(e.pointerId)
    window.ftCustom?.windowDrag('end')
  }
  bar.addEventListener('pointerup', endDrag)
  bar.addEventListener('pointercancel', endDrag)
  bar.addEventListener('lostpointercapture', () => window.ftCustom?.windowDrag('end'))
  window.ftCustom?.onWindowState((state) => {
    root.classList.toggle('ft-fullscreen', state.fullscreen)
    root.classList.toggle('ft-maximized', state.maximized)
    bar.querySelector('.ft-max').setAttribute('aria-pressed', String(state.maximized))
  })
  function setControlValues() {
    for (const [name, value] of Object.entries(settings)) {
      const input = panel?.querySelector(`[name="${name}"]`)
      if (input) {
        if (input.type === 'checkbox') input.checked = value
        else input.value = value
      }
      const output = panel?.querySelector(`[data-output="${name}"]`)
      if (output)
        output.textContent =
          value +
          (name === 'size'
            ? ' px'
            : name === 'position' || name === 'background'
              ? '%'
              : name === 'stroke'
                ? ' px'
                : '')
    }
  }
  const range = (name, label, min, max, step = 1) =>
    `<div><label for="ft-${name}">${label}<output data-output="${name}"></output></label><input id="ft-${name}" name="${name}" type="range" min="${min}" max="${max}" step="${step}"></div>`
  function mountPanel() {
    const host = document.querySelector('.settingsSections')
    if (!host || panel?.isConnected) return
    panel = document.createElement('section')
    panel.id = 'ft-apple-settings'
    panel.innerHTML = `<h2>Captions</h2><p class="ft-subtitle">Up to three words, revealed as they are spoken.</p>
      <div class="ft-preview"><div class="ft-caption-preview-position"><span class="ft-caption-preview-text">Every word matters</span></div></div>
      <div class="ft-grid">
        ${range('size', 'Size', 24, 160, 2)}${range('position', 'Position from top', 10, 90)}
        <div><label for="ft-font">Font</label><input id="ft-font" name="font" type="text" list="ft-fonts" autocomplete="off"><datalist id="ft-fonts"></datalist></div>
        <div><label for="ft-weight">Weight</label><select id="ft-weight" name="weight"><option value="700">Bold · 700</option><option value="800">Extra bold · 800</option><option value="900">Black · 900</option></select></div>
        <div><label for="ft-color">Text color</label><input id="ft-color" name="color" type="color"></div>
        ${range('stroke', 'Outline width', 0, 5, 0.25)}
      </div>
      <details><summary>More appearance options</summary><div class="ft-grid">
        <div><label for="ft-outline">Outline color</label><input id="ft-outline" name="outline" type="color"></div>
        ${range('background', 'Background opacity', 0, 100)}
        <div><label for="ft-preset">Caption style</label><select id="ft-preset"><option value="">Choose a style…</option><option value="apple">Apple</option><option value="simple">Simple</option><option value="purple">Purple</option><option value="white-outline">White with outline</option><option value="white-tall">Condensed white</option></select></div>
        <div><label for="ft-animation">Animate captions<input type="checkbox" id="ft-animation" name="animation"></label></div>
        <div><label for="ft-theme">App theme</label><select name="theme" id="ft-theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
        <div><label for="ft-font-file">Add a font</label><input type="file" id="ft-font-file" accept=".ttf,.otf,.woff,.woff2" multiple></div>
      </div><p class="ft-note">SF Pro, SF Rounded, SF Mono, and New York are available if you install or import them. Unavailable fonts fall back to Inter or your system font. Imported fonts stay in your FreeTube profile.</p><p id="ft-font-status" class="ft-note" role="status"></p></details>
      <div class="ft-actions"><button id="ft-reset">Reset appearance</button><button id="ft-advanced" aria-expanded="false">All FreeTube settings</button></div>
      <p class="ft-note">Appearance settings are saved automatically. Timing is approximate when captions do not include individual word timestamps.</p>`
    const list = panel.querySelector('#ft-fonts')
    for (const font of [
      ...new Set([
        'Inter',
        'SF Pro Display',
        'SF Pro Text',
        'SF Pro Rounded',
        'SF Mono',
        'New York',
        ...(window.__ftInstalledFonts || []),
      ]),
    ]) {
      const option = document.createElement('option')
      option.value = font
      list.append(option)
    }
    host.prepend(panel)
    setControlValues()
    const advanced = panel.querySelector('#ft-advanced')
    function updateAdvanced() {
      advanced.textContent = settings.minimal ? 'All FreeTube settings' : 'Hide additional settings'
      advanced.setAttribute('aria-expanded', String(!settings.minimal))
    }
    updateAdvanced()
    panel.addEventListener('input', (e) => {
      const name = e.target.name
      if (!(name in defaults)) return
      settings = normalize({
        ...settings,
        [name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
      })
      save()
      setControlValues()
    })
    panel.querySelector('#ft-preset').onchange = (e) => {
      if (presets[e.target.value]) {
        settings = normalize({ ...settings, ...presets[e.target.value] })
        save()
        setControlValues()
      }
    }
    panel.querySelector('#ft-reset').onclick = () => {
      settings = { ...defaults }
      save()
      setControlValues()
      updateAdvanced()
    }
    advanced.onclick = () => {
      settings.minimal = !settings.minimal
      save()
      updateAdvanced()
    }
    panel.querySelector('#ft-font-file').onchange = async (e) => {
      const status = panel.querySelector('#ft-font-status')
      try {
        for (const file of e.target.files) {
          if (file.size > 20 * 1024 * 1024) throw new Error('Font exceeds 20 MB')
          const name = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').slice(0, 100)
          const data = await file.arrayBuffer()
          await loadFont(name, data)
          await storeFont(name, data)
          const option = document.createElement('option')
          option.value = name
          list.append(option)
          settings.font = name
          save()
          setControlValues()
        }
        status.textContent = 'Font imported and saved.'
      } catch (error) {
        status.textContent = `Could not import font: ${error.message}`
      }
    }
  }
  function openFonts() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('freetube-custom-fonts', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('fonts')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  async function loadFont(name, data) {
    const face = new FontFace(name, data, { weight: '100 900' })
    await face.load()
    document.fonts.add(face)
  }
  async function storeFont(name, data) {
    const db = await openFonts()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('fonts', 'readwrite')
      tx.objectStore('fonts').put(data, name)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        reject(tx.error)
      }
    })
  }
  openFonts()
    .then((db) => {
      const tx = db.transaction('fonts')
      const cursor = tx.objectStore('fonts').openCursor()
      cursor.onsuccess = () => {
        const c = cursor.result
        if (c) {
          loadFont(c.key, c.value).catch(console.error)
          c.continue()
        }
      }
      tx.oncomplete = () => db.close()
    })
    .catch(console.error)
  const observer = new MutationObserver(() => {
    if (!layoutTimer)
      layoutTimer = setTimeout(() => {
        layoutTimer = null
        mountPanel()
      }, 150)
  })
  observer.observe(document.querySelector('#app') || document.body, {
    childList: true,
    subtree: true,
  })
  mountPanel()
  window.__ftAppleSettings = {
    get: () => ({ ...settings }),
    set: (value) => {
      settings = normalize({ ...settings, ...value })
      save()
      setControlValues()
    },
  }
})()
