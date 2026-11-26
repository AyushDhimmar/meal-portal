import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Stack, Text } from '@mantine/core'
import { IconCameraOff } from '@tabler/icons-react'
import { createDetector } from '../../lib/barcodeDetector'
import classes from './CameraScanner.module.css'

type Props = { onScan: (value: string) => void; paused?: boolean }

const CODE = /^(1R-?)?\d{1,4}$/i

/** Live camera view that reads employee QR codes and barcodes (US-015). */
export function CameraScanner({ onScan, paused }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const onScanRef = useRef(onScan)
  const pausedRef = useRef(paused)
  useEffect(() => { onScanRef.current = onScan; pausedRef.current = paused })

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let stopped = false
    // a badge held in view must be read once, not again every few seconds
    const last = { value: '', seenAt: 0 }

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError('The camera only works on a secure (https) page. Use the LAN mode address, or the code keypad.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return }
        const v = video.current!
        v.srcObject = stream
        await v.play()
        setReady(true)
        const detector = await createDetector()
        const tick = async () => {
          if (stopped) return
          if (!pausedRef.current && v.readyState >= 2) {
            try {
              const found = await detector.detect(v)
              const value = found.map((f) => f.rawValue.trim()).find((x) => CODE.test(x))
              const now = Date.now()
              if (value) {
                // same code again: only counts once it has been out of view for 1.5 s
                const fresh = value !== last.value || now - last.seenAt > 1500
                last.value = value; last.seenAt = now
                if (fresh) { navigator.vibrate?.(60); onScanRef.current(value) }
              }
            } catch { /* a bad frame: try the next one */ }
          }
          timer = setTimeout(tick, 150)
        }
        tick()
      } catch (e) {
        const name = (e as DOMException)?.name
        setError(name === 'NotAllowedError' ? 'Camera permission was refused. Allow the camera for this site in the browser settings, then try again.'
          : name === 'NotFoundError' ? 'No camera found on this device. Use the code keypad or a USB scanner.'
          : name === 'NotReadableError' ? 'The camera is in use by another app. Close it and try again.'
          : 'The camera could not start. Use the code keypad instead.')
      }
    }
    start()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [attempt])

  if (error) {
    return (
      <Alert color="orange" variant="light" icon={<IconCameraOff size={18} />} mt="md">
        <Stack gap="xs"><Text size="sm">{error}</Text>
          <Button size="xs" variant="light" w="fit-content" onClick={() => { setError(null); setReady(false); setAttempt((a) => a + 1) }}>Try again</Button>
        </Stack>
      </Alert>
    )
  }
  return (
    <div className={classes.wrap}>
      <video ref={video} className={classes.video} playsInline muted aria-label="Camera view" />
      <div className={classes.frame}><div className={classes.laser} /></div>
      {!ready && <Text className={classes.status}>Starting camera…</Text>}
      <Text className={classes.hint}>Hold the QR code or barcode inside the frame</Text>
    </div>
  )
}
