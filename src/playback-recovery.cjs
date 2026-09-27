// The route watcher already reloads the player. Never reload it a second time
// after a successful route change. A repeated SABR request still needs a direct
// recovery, otherwise the stream can remain stalled.
module.exports = async function onPlayerReloadRequested() {
  if (this.isLoading || this.__ftSabrRecovering) return
  this.__ftSabrRecovering = true
  try {
    const position = this.getWatchedProgress()
    if (
      Number.isFinite(position) &&
      position > 0 &&
      String(this.$route.query.oneTimeTimestamp) !== String(position)
    ) {
      await this.$router.replace({
        path: this.$route.path,
        query: { ...this.$route.query, oneTimeTimestamp: position },
      })
      // $route's watcher owns this recovery, including timestamp restoration.
      return
    }
    await this.reloadView()
  } finally {
    this.__ftSabrRecovering = false
  }
}
