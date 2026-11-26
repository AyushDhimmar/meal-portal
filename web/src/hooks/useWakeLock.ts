import { useEffect } from 'react'

/** Keeps the screen on while the component is shown (where the browser supports it). */
export function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const request = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          lock = await navigator.wakeLock.request('screen')
          if (cancelled) await lock.release()
        }
      } catch { /* not supported or denied: the code still shows */ }
    }
    request()
    // the browser drops the lock when the tab is hidden; take it again on return
    const onVisible = () => { if (document.visibilityState === 'visible') request() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [])
}
