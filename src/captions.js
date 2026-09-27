;(() => {
  window.__freeTubeCaptionController?.destroy?.()
  const timeline = new FTCaptionEngine.Timeline()
  let video,
    displayer,
    cueArray,
    cueLength = -1,
    firstCue,
    lastCue,
    overlay,
    textNode,
    timer
  let stopped = false,
    seeking = false,
    nextDiscovery = 0,
    nextCueCheck = 0
  const metrics = { ticks: 0, discoveries: 0, rebuilds: 0, mode: 'native', error: null }
  const isCue = (cue) =>
    cue &&
    Number.isFinite(cue.startTime) &&
    Number.isFinite(cue.endTime) &&
    typeof (cue.payload ?? cue.text) === 'string'
  const textOf = (cue) =>
    String(cue.payload ?? cue.text ?? '')
      .replace(/<[^>]*>/g, '')
      .trim()
  function getCues(value) {
    if (!value) return null
    for (const key of Reflect.ownKeys(value)) {
      let candidate
      try {
        candidate = value[key]
      } catch {
        continue
      }
      if (Array.isArray(candidate) && (candidate.length ? isCue(candidate[0]) : key === 'j'))
        return candidate
    }
    return null
  }
  // Some tracks contain word cues, others contain timed phrases.  Both use the
  // same cue boundaries; Timeline divides a phrase evenly only when word-level
  // timing is unavailable. Pages contain up to three words, revealed on time.
  function hasWordTimings(cues) {
    return cues.some((cue) => isCue(cue) && textOf(cue))
  }
  function discover() {
    metrics.discoveries++
    const controls = (video?.ui || video?.closest('.shaka-video-container')?.ui)?.getControls?.()
    const queue = [{ value: controls, depth: 0 }],
      seen = new Set()
    while (queue.length && seen.size < 120) {
      const { value, depth } = queue.shift()
      if (!value || seen.has(value)) continue
      seen.add(value)
      // TextDisplayer is the object that both owns timed cues and appends them.
      // Looking for isTextVisible alone can select a parent controller, leaving
      // the custom overlay in native fallback mode.
      if (
        typeof value.append === 'function' &&
        typeof value.isTextVisible === 'function' &&
        getCues(value)
      )
        return value
      if (depth >= 4) continue
      for (const key of Reflect.ownKeys(value)) {
        let child
        try {
          child = value[key]
        } catch {
          continue
        }
        if (
          !child ||
          typeof child !== 'object' ||
          child instanceof Node ||
          child instanceof Window ||
          Array.isArray(child) ||
          child instanceof Map ||
          child instanceof Set
        )
          continue
        queue.push({ value: child, depth: depth + 1 })
      }
    }
    return null
  }
  function hideCustom() {
    const container = video?.closest('.shaka-video-container')
    container?.classList.remove('ft-custom-captions-ready')
    if (overlay) overlay.hidden = true
    metrics.mode = 'native'
  }
  function render(words) {
    const container = video?.closest('.shaka-video-container')
    if (!container) return
    if (!overlay?.isConnected || overlay.parentNode !== container) {
      overlay?.remove()
      overlay = document.createElement('div')
      overlay.id = 'freetube-custom-caption-overlay'
      overlay.setAttribute('aria-hidden', 'true')
      textNode = document.createElement('span')
      textNode.className = 'freetube-custom-caption-text'
      overlay.append(textNode)
      container.append(overlay)
    }
    textNode.textContent = words.join(' ')
    overlay.hidden = words.length === 0
    container.classList.add('ft-custom-captions-ready')
    metrics.mode = 'three-word'
  }
  function reset() {
    timeline.reset()
    cueArray = null
    cueLength = -1
    firstCue = null
    lastCue = null
    seeking = true
  }
  function onSeek() {
    reset()
    nextCueCheck = 0
    schedule(0)
  }
  function schedule(delay) {
    clearTimeout(timer)
    if (!stopped) timer = setTimeout(tick, delay)
  }
  function tick() {
    if (stopped) return
    metrics.ticks++
    try {
      const now = performance.now()
      if (!video?.isConnected) {
        video?.removeEventListener('seeking', onSeek)
        video = document.querySelector('video')
        displayer = null
        nextDiscovery = 0
        reset()
        video?.addEventListener('seeking', onSeek)
      }
      if (!video) return schedule(250)
      if (now >= nextDiscovery) {
        const found = discover()
        if (found !== displayer) {
          displayer = found
          reset()
        }
        nextDiscovery = now + (displayer ? 2000 : 500)
      }
      const cues = getCues(displayer)
      if (!cues || !hasWordTimings(cues) || displayer?.isTextVisible?.() === false) hideCustom()
      else {
        if (now >= nextCueCheck || seeking) {
          // Shaka frequently reuses an array length while replacing its oldest
          // and newest cues.  Track the boundaries as well, or expired words
          // can remain visible through silence.
          if (
            cueArray !== cues ||
            cueLength !== cues.length ||
            firstCue !== cues[0] ||
            lastCue !== cues.at(-1)
          ) {
            timeline.update(cues)
            cueArray = cues
            cueLength = cues.length
            firstCue = cues[0]
            lastCue = cues.at(-1)
            metrics.rebuilds++
          }
          nextCueCheck = now + 100
        }
        render(timeline.at(video.currentTime, seeking))
        seeking = false
      }
      metrics.error = null
    } catch (error) {
      metrics.error = error.message
      hideCustom()
      displayer = null
      nextDiscovery = 0
    }
    schedule(video?.paused || document.hidden ? 250 : 35)
  }
  window.__freeTubeCaptionController = {
    metrics,
    destroy() {
      stopped = true
      clearTimeout(timer)
      video?.removeEventListener('seeking', onSeek)
      overlay?.remove()
      video?.closest('.shaka-video-container')?.classList.remove('ft-custom-captions-ready')
    },
  }
  window.__freeTubeCaptionTweaks = true
  tick()
})()
