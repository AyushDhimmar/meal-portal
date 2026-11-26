import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'

/** QR code of the employee code (scanned by the counter camera). */
export function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    QRCode.toString(value, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#0F172A', light: '#FFFFFF' } })
      .then(setSvg).catch(() => setSvg(''))
  }, [value])
  // the SVG is generated locally from a validated employee code, never from user-supplied markup
  return <div role="img" aria-label={`QR code for ${value}`} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
}

/** Code 128 barcode (read by USB counter scanners). */
export function Barcode({ value, height = 64 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (ref.current) JsBarcode(ref.current, value, { format: 'CODE128', displayValue: false, height, margin: 0, width: 2, lineColor: '#0F172A' })
  }, [value, height])
  return <svg ref={ref} role="img" aria-label={`Barcode for ${value}`} style={{ maxWidth: '100%' }} />
}
