/* Stable subtitle pages: a page is never a sliding window of words. */
;(function (root) {
  // Keep speech readable and compact: punctuation is removed except questions
  // and apostrophes, which can change how a word is understood.
  const clean = (text) =>
    String(text || '')
      .replace(/<[^>]*>/g, '')
      .replace(/>>|[♪♫]/g, '')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/[’]/g, "'")
      .replace(/[^\p{L}\p{N}\s?']/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
  const key = (w) => `${Math.round(w.start * 1000)}:${w.text}`
  function wordsFromCues(cues) {
    const words = []
    function visit(cue) {
      if (cue.nestedCues?.length) {
        const lastBreak = cue.nestedCues.findLastIndex((c) => c.lineBreak)
        for (const child of cue.nestedCues.slice(lastBreak + 1)) visit(child)
        return
      }
      const text = clean(cue.payload ?? cue.text)
      if (!text || !Number.isFinite(cue.startTime) || cue.endTime <= cue.startTime) return
      const parts = text.split(/\s+/)
      const step = (cue.endTime - cue.startTime) / parts.length
      parts.forEach((text, i) =>
        words.push({ text, start: cue.startTime + i * step, end: cue.startTime + (i + 1) * step }),
      )
    }
    for (const cue of cues) visit(cue)
    words.sort((a, b) => a.start - b.start)
    const seen = new Set()
    return words.filter((w) => {
      const k = key(w)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }
  class Timeline {
    constructor() {
      this.reset()
    }
    reset() {
      this.groups = []
      this.ordinals = new Map()
      this.active = null
      this.lastTime = null
    }
    update(cues) {
      const words = wordsFromCues(cues)
      // Retain the grouping phase when Shaka prunes old cues from its buffer.
      const anchor = words.findIndex((w) => this.ordinals.has(key(w)))
      let ordinal = anchor < 0 ? 0 : this.ordinals.get(key(words[anchor])) - anchor
      const groups = []
      let group = null
      const ordinals = new Map()
      for (let i = 0; i < words.length; i++, ordinal++) {
        const word = words[i]
        // YouTube can keep a word cue open until the next utterance. Use
        // starts as well as ends to keep a later word out of a paused page.
        if (i && (word.start - words[i - 1].end > 0.8 || word.start - words[i - 1].start > 0.8))
          ordinal += (3 - (((ordinal % 3) + 3) % 3)) % 3
        ordinals.set(key(word), ordinal)
        const id = Math.floor(ordinal / 3)
        if (!group || group.id !== id) {
          group = { id, start: word.start, end: word.end, words: [], timings: [] }
          groups.push(group)
        }
        group.words.push(word.text)
        group.timings.push(word)
        group.end = Math.min(Math.max(group.end, word.end), word.start + 3)
      }
      for (let i = 0; i < groups.length - 1; i++)
        groups[i].end = Math.min(groups[i].end, groups[i + 1].start)
      if (this.active) {
        const refreshed = groups.find(
          (g) =>
            g.id === this.active.id &&
            g.timings.some((w) => this.active.timings.some((old) => key(old) === key(w))),
        )
        if (refreshed) {
          const retained = new Map(this.active.timings.map((w) => [key(w), w]))
          for (const word of refreshed.timings) retained.set(key(word), word)
          const timings = [...retained.values()].sort((a, b) => a.start - b.start)
          this.active = {
            ...refreshed,
            start: timings[0].start,
            words: timings.map((w) => w.text),
            timings,
          }
        } else this.active = null
      }
      this.ordinals = ordinals
      this.groups = groups
    }
    at(time, seeking = false) {
      if (
        seeking ||
        (this.lastTime !== null && (time < this.lastTime - 0.15 || time - this.lastTime > 1.5))
      )
        this.active = null
      this.lastTime = time
      if (this.active && time >= this.active.start && time < this.active.end)
        return this.active.timings.filter((w) => w.start <= time).map((w) => w.text)
      let lo = 0,
        hi = this.groups.length
      while (lo < hi) {
        const mid = (lo + hi) >>> 1
        if (this.groups[mid].start <= time) lo = mid + 1
        else hi = mid
      }
      const group = this.groups[lo - 1]
      this.active =
        group && time < group.end
          ? { ...group, words: [...group.words], timings: [...group.timings] }
          : null
      return this.active?.timings.filter((w) => w.start <= time).map((w) => w.text) || []
    }
  }
  // Untimed captions have no word boundaries. Keep whole pages stable and
  // consume only newly appended words; do not requeue rolling captions.
  class Fallback {
    constructor() {
      this.reset()
    }
    reset() {
      this.previous = []
      this.queue = []
      this.page = []
      this.until = 0
      this.lastTime = null
    }
    at(text, time, seeking = false) {
      if (
        seeking ||
        (this.lastTime !== null && (time < this.lastTime - 0.15 || time - this.lastTime > 1.5))
      )
        this.reset()
      this.lastTime = time
      const next = clean(text).split(/\s+/).filter(Boolean)
      if (next.join(' ') !== this.previous.join(' ')) {
        let overlap = Math.min(next.length, this.previous.length)
        while (
          overlap &&
          this.previous.slice(-overlap).join(' ') !== next.slice(0, overlap).join(' ')
        )
          overlap--
        this.queue.push(...next.slice(overlap))
        this.previous = next
      }
      if (time >= this.until) {
        this.page = this.queue.splice(0, 3)
        this.until = time + Math.max(0.75, this.page.length * 0.32)
      }
      return this.page
    }
  }
  const api = { Timeline, Fallback, wordsFromCues }
  if (typeof module !== 'undefined') module.exports = api
  else root.FTCaptionEngine = api
})(globalThis)
