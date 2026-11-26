import { BarcodeDetector as Ponyfill, prepareZXingModule } from 'barcode-detector/ponyfill'
// Bundle the decoder with the app (no CDN download on first scan; works on locked-down networks)
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

prepareZXingModule({
  overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
})

const FORMATS = ['qr_code', 'code_128'] as const

export type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> }

/** The browser's own detector when it reads our formats (Android Chrome), otherwise the bundled one. */
export async function createDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: typeof Ponyfill }).BarcodeDetector
  if (Native) {
    try {
      const supported = await Native.getSupportedFormats()
      if (FORMATS.every((f) => supported.includes(f))) return new Native({ formats: [...FORMATS] })
    } catch { /* fall through */ }
  }
  return new Ponyfill({ formats: [...FORMATS] })
}
