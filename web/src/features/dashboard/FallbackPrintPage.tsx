import { useEffect, useState } from 'react'
import { Button, Center, Loader } from '@mantine/core'
import { IconPrinter } from '@tabler/icons-react'
import { useSearchParams } from 'react-router'
import { longDate, todayIn } from '../../lib/dates'
import { useDayListQuery } from './api'
import classes from './FallbackPrintPage.module.css'

const time = (iso: string) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))

/** Printable lunch list for paper verification (US-009). "Save as PDF" in the print dialog makes the PDF. */
export function FallbackPrintPage() {
  const [params] = useSearchParams()
  const day = params.get('date') ?? todayIn()
  const { data, isLoading } = useDayListQuery(day, { refetchOnMountOrArgChange: true })
  const rows = (data ?? []).filter((r) => r.expected)
  const [printedAt] = useState(() => new Date())

  useEffect(() => { if (data) { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t) } }, [data])

  if (isLoading) return <Center mih="100vh"><Loader /></Center>
  return (
    <div className={classes.page}>
      <div className={classes.noPrint}>
        <Button leftSection={<IconPrinter size={18} />} onClick={() => window.print()}>Print / Save as PDF</Button>
      </div>
      <h1 className={classes.title}>Lunch list · {longDate(day)}</h1>
      <p className={classes.meta}>{rows.length} expected · printed {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(printedAt)} · Tick each person served; an Admin enters the ticks afterwards.</p>
      <table className={classes.table}>
        <thead><tr><th>#</th><th>Code</th><th>Name</th><th>Department</th><th>Served ✓</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.emp_code}>
              <td>{i + 1}</td><td className={classes.code}>{r.emp_code}</td><td>{r.name}</td><td>{r.department ?? ''}</td>
              <td className={classes.tick}>{r.served_at ? `already ${time(r.served_at)}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
