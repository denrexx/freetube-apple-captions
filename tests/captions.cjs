const { test } = require('node:test')
const assert = require('node:assert/strict')
const { Timeline, wordsFromCues, Fallback } = require('../src/caption-engine.js')
const cues = 'one two three four five six seven eight nine'
  .split(' ')
  .map((payload, i) => ({ payload, startTime: i * 0.5, endTime: (i + 1) * 0.5 }))
test('pages reveal only spoken words and switch after three words', () => {
  const t = new Timeline()
  t.update(cues)
  for (const time of [0, 0.2]) assert.deepEqual(t.at(time), ['one'])
  for (const time of [0.5, 0.8]) assert.deepEqual(t.at(time), ['one', 'two'])
  for (const time of [1, 1.49]) assert.deepEqual(t.at(time), ['one', 'two', 'three'])
  for (const time of [1.5, 1.8]) assert.deepEqual(t.at(time), ['four'])
  assert.deepEqual(t.at(2), ['four', 'five'])
  assert.deepEqual(t.at(2.9), ['four', 'five', 'six'])
  assert.deepEqual(t.at(4.5), [])
})
test('seeking backwards resets the frozen page', () => {
  const t = new Timeline()
  t.update(cues)
  t.at(3)
  assert.deepEqual(t.at(0.6, true), ['one', 'two'])
})
test('buffer pruning preserves the phase of triple grouping', () => {
  const t = new Timeline()
  t.update(cues)
  t.at(1)
  t.update(cues.slice(1))
  assert.deepEqual(t.at(1.2), ['one', 'two', 'three'])
  assert.deepEqual(t.at(1.6), ['four'])
})
test('untimed phrase cues are subdivided over their full duration', () => {
  const t = new Timeline()
  t.update([{ payload: 'one two three four five six', startTime: 0, endTime: 3 }])
  assert.deepEqual(t.at(0.25), ['one'])
  assert.deepEqual(t.at(1.49), ['one', 'two', 'three'])
  assert.deepEqual(t.at(1.5), ['four'])
})
test('a short utterance keeps its one or two words instead of waiting for three', () => {
  const t = new Timeline()
  t.update([
    { payload: 'one', startTime: 0, endTime: 0.5 },
    { payload: 'two', startTime: 0.5, endTime: 1 },
    { payload: 'three', startTime: 3, endTime: 3.5 },
  ])
  assert.deepEqual(t.at(0.75), ['one', 'two'])
  assert.deepEqual(t.at(3.1), ['three'])
})
test('captions disappear during a gap between utterances', () => {
  const t = new Timeline()
  t.update([
    { payload: 'one', startTime: 0, endTime: 0.5 },
    { payload: 'two', startTime: 0.5, endTime: 1 },
    { payload: 'three', startTime: 4, endTime: 4.5 },
  ])
  assert.deepEqual(t.at(1.01), [])
  assert.deepEqual(t.at(3.99), [])
  assert.deepEqual(t.at(4), ['three'])
})
test('a replaced cue buffer does not retain words from before silence', () => {
  const t = new Timeline()
  t.update([{ payload: 'old', startTime: 0, endTime: 1 }])
  assert.deepEqual(t.at(0.5), ['old'])
  t.update([{ payload: 'new', startTime: 5, endTime: 6 }])
  assert.deepEqual(t.at(1.01), [])
})
test('extended cue ends do not show future words or survive a long pause', () => {
  const t = new Timeline()
  t.update([
    { payload: 'one', startTime: 0, endTime: 10 },
    { payload: 'two', startTime: 0.5, endTime: 10 },
    { payload: 'three', startTime: 10, endTime: 15 },
  ])
  assert.deepEqual(t.at(0), ['one'])
  assert.deepEqual(t.at(0.5), ['one', 'two'])
  assert.deepEqual(t.at(3.49), ['one', 'two'])
  assert.deepEqual(t.at(3.5), [])
  assert.deepEqual(t.at(9.99), [])
  assert.deepEqual(t.at(10), ['three'])
  assert.deepEqual(t.at(13), [])
})
test('new buffered words join the active page only when their time arrives', () => {
  const t = new Timeline()
  t.update(cues.slice(0, 1))
  assert.deepEqual(t.at(0.1), ['one'])
  t.update(cues.slice(0, 3))
  assert.deepEqual(t.at(0.2), ['one'])
  assert.deepEqual(t.at(0.6), ['one', 'two'])
  assert.deepEqual(t.at(1.1), ['one', 'two', 'three'])
})
test('rolling duplicate cues are deduplicated and gaps clear the overlay', () => {
  const t = new Timeline()
  t.update([...cues, ...cues])
  assert.equal(t.groups[0].words.length, 3)
  assert.deepEqual(t.at(10), [])
})
test('nested timed cue payloads retain actual timestamps', () => {
  assert.deepEqual(
    wordsFromCues([{ payload: '', startTime: 0, endTime: 2, nestedCues: cues.slice(0, 3) }]).map(
      (w) => w.start,
    ),
    [0, 0.5, 1],
  )
})
test('caption words retain only question marks and apostrophes', () => {
  const words = wordsFromCues([
    { payload: "Hello, don't! Why...? [music]", startTime: 0, endTime: 3 },
  ]).map((w) => w.text)
  assert.deepEqual(words, ['Hello', "don't", 'Why?'])
})
test('DOM fallback keeps a page stable while more words arrive', () => {
  const f = new Fallback()
  assert.deepEqual(f.at('one two three', 0), ['one', 'two', 'three'])
  assert.deepEqual(f.at('two three four', 0.2), ['one', 'two', 'three'])
  assert.deepEqual(f.at('three four five', 0.5), ['one', 'two', 'three'])
})
