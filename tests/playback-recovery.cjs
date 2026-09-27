const { test } = require('node:test')
const assert = require('node:assert/strict')
const recover = require('../src/playback-recovery.cjs')
function fixture(position = 123.75) {
  const ctx = {
    isLoading: false,
    $route: { path: '/watch/test', query: { playlistId: 'kept' } },
    getWatchedProgress: () => position,
    reloads: 0,
  }
  ctx.reloadView = async () => {
    ctx.reloads++
  }
  ctx.$router = {
    replace: async (route) => {
      ctx.$route = route
      await ctx.reloadView()
    },
  }
  return ctx
}
test('SABR recovery reloads once through the route watcher and preserves progress', async () => {
  const ctx = fixture()
  await recover.call(ctx)
  assert.equal(ctx.reloads, 1)
  assert.equal(ctx.$route.query.oneTimeTimestamp, 123.75)
  assert.equal(ctx.$route.query.playlistId, 'kept')
})
test('concurrent SABR requests are coalesced', async () => {
  const ctx = fixture()
  await Promise.all([recover.call(ctx), recover.call(ctx), recover.call(ctx)])
  assert.equal(ctx.reloads, 1)
})
test('zero progress and unchanged route recover once without duplicate navigation', async () => {
  for (const position of [0, 123.75]) {
    const ctx = fixture(position)
    ctx.$route.query.oneTimeTimestamp = position
    await recover.call(ctx)
    assert.equal(ctx.reloads, 1)
  }
})
test('loading player ignores stale recovery requests; failures release the guard', async () => {
  const ctx = fixture()
  ctx.isLoading = true
  await recover.call(ctx)
  assert.equal(ctx.reloads, 0)
  ctx.isLoading = false
  ctx.$router.replace = async () => {
    throw new Error('navigation failed')
  }
  await assert.rejects(recover.call(ctx))
  assert.equal(ctx.__ftSabrRecovering, false)
})
