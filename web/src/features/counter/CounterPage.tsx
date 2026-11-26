import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert, Avatar, Badge, Button, Card, Group, Progress, SegmentedControl, Stack, Switch, Text, TextInput, Title, UnstyledButton } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconBackspace, IconSearch } from '@tabler/icons-react'
import { Link } from 'react-router'
import { errorMessage } from '../../lib/errors'
import { normalizeEmpCode } from '../../lib/empCode'
import { initials } from '../../lib/format'
import { APP_TZ, formatMoment } from '../../lib/dates'
import { RefreshButton } from '../../components/RefreshButton'
import { CameraScanner } from './CameraScanner'
import { ResultCard } from './ResultCard'
import { useCounterCountsQuery, useCounterRecentQuery, useCounterSearchQuery, useVerifyMutation, type Method, type VerifyResult } from './api'
import classes from './CounterPage.module.css'

const AUTO_KEY = 'meal-portal:auto-mark'
const readAuto = () => { try { return localStorage.getItem(AUTO_KEY) !== 'off' } catch { return true } }
const time = (iso: string) => formatMoment(iso, APP_TZ, { hour: 'numeric', minute: '2-digit' })

export function CounterPage() {
  const [mode, setMode] = useState<'code' | 'scan' | 'name'>('code')
  const [code, setCode] = useState('')
  const [q, setQ] = useState('')
  const [debouncedQ] = useDebouncedValue(q, 250)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [auto, setAuto] = useState(readAuto)
  const input = useRef<HTMLInputElement>(null)

  const [verify, verifying] = useVerifyMutation()
  // fresh when the screen opens; afterwards only after a serve here or the Refresh button
  const counts = useCounterCountsQuery(undefined, { refetchOnMountOrArgChange: true })
  const recent = useCounterRecentQuery(undefined, { refetchOnMountOrArgChange: true })
  const term = mode === 'name' ? debouncedQ.trim() : ''
  const search = useCounterSearchQuery(term, { skip: term.length < 2 })
  const refreshing = counts.isFetching || recent.isFetching
  const refresh = () => { counts.refetch(); recent.refetch() }

  // keep the code box focused so a USB scanner (which types + Enter) always lands in it
  useEffect(() => { if (mode === 'code') input.current?.focus() }, [mode, result])

  async function check(raw: string, method: Method) {
    const c = normalizeEmpCode(raw)
    if (!c) return
    setCode('')
    try {
      const r = await verify({ code: c, mark: auto, method }).unwrap()
      setResult(r)
      if (!['SERVED', 'ELIGIBLE'].includes(r.result)) navigator.vibrate?.(200)
    } catch { setResult(null) }
  }

  async function serveNow() {
    if (!result?.employee) return
    const r = await verify({ code: result.employee.emp_code, mark: true, method: 'code' }).unwrap().catch(() => null)
    if (r) setResult(r)
  }

  function typed(v: string) {
    const clean = v.toUpperCase().replace(/\s/g, '')
    setCode(clean)
    // 4 digits (with or without 1R-) is a complete code: check straight away, no button
    if (/^(1R-?)?\d{4}$/.test(clean)) check(clean, 'code')
  }

  function key(k: string) {
    if (k === 'back') setCode((c) => c.slice(0, -1))
    else typed(code + k)
    input.current?.focus()
  }

  function submit(e: FormEvent) { e.preventDefault(); if (code.trim()) check(code, 'code') }
  function toggleAuto(v: boolean) { setAuto(v); try { localStorage.setItem(AUTO_KEY, v ? 'on' : 'off') } catch { /* fine */ } }
  function next() { setResult(null); verifying.reset(); input.current?.focus() }

  const served = counts.data?.served_expected ?? 0
  const expected = counts.data?.expected ?? 0

  return (
    <Stack gap="md">
      <Group justify="space-between" align="end">
        <div>
          <Title order={2}>Lunch counter</Title>
          <Text c="dimmed" size="sm">{counts.data ? new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(counts.data.day + 'T00:00:00')) : ' '}</Text>
        </div>
        <Group gap="sm" wrap="nowrap">
          <UnstyledButton component={Link} to="/counter/today">
            <Text fw={700} fz={22} ta="right">{served}<Text span c="dimmed" fz={16} fw={500}> / {expected} served</Text></Text>
          </UnstyledButton>
          <RefreshButton busy={refreshing} onClick={refresh} />
        </Group>
      </Group>
      <Progress value={expected ? (served / expected) * 100 : 0} size="md" radius="xl" />

      <div className={classes.layout}>
        {/* input side */}
        <Card className={classes.inputCard}>
          <SegmentedControl fullWidth size="md" value={mode} onChange={(v) => setMode(v as 'code' | 'scan' | 'name')}
            data={[{ value: 'code', label: 'Code' }, { value: 'scan', label: 'Scan' }, { value: 'name', label: 'Name' }]} />

          {mode === 'code' ? (
            <form onSubmit={submit}>
              {/* shows exactly what was typed: a USB scanner types "1R-0123" one character at a time */}
              <TextInput ref={input} mt="md" size="xl" classNames={{ input: classes.codeInput }} placeholder="0123"
                aria-label="Employee code" autoComplete="off" inputMode="numeric"
                value={code} onChange={(e) => typed(e.currentTarget.value)} />
              <div className={classes.keypad}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => <button type="button" key={k} onClick={() => key(k)}>{k}</button>)}
                <button type="button" onClick={() => { setCode(''); input.current?.focus() }} aria-label="Clear">C</button>
                <button type="button" onClick={() => key('0')}>0</button>
                <button type="button" onClick={() => key('back')} aria-label="Delete"><IconBackspace size={24} /></button>
              </div>
              <Text size="xs" c="dimmed" ta="center" mt="xs">Type the 4 digits after 1R-. Checks automatically; USB scanners work here too.</Text>
            </form>
          ) : mode === 'scan' ? (
            <CameraScanner onScan={(v) => check(v, 'scan')} paused={verifying.isLoading} />
          ) : (
            <Stack mt="md" gap="xs">
              <TextInput size="lg" leftSection={<IconSearch size={20} />} placeholder="Type at least 2 letters" value={q}
                onChange={(e) => setQ(e.currentTarget.value)} autoFocus aria-label="Search by name" />
              {search.data?.map((p) => (
                <UnstyledButton key={p.emp_code} className={classes.nameRow} onClick={() => { check(p.emp_code, 'name'); }}>
                  <Avatar radius="xl" color="brand">{initials(p.name)}</Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text fw={600} truncate>{p.name}</Text>
                    <Text size="xs" c="dimmed">{p.emp_code}{p.department ? ` · ${p.department}` : ''}</Text>
                  </div>
                  {p.served ? <Badge color="gray" variant="light">Served</Badge>
                    : p.eligible ? <Badge color="green" variant="light">Eligible</Badge>
                    : <Badge color="red" variant="light">Not eligible</Badge>}
                </UnstyledButton>
              ))}
              {debouncedQ.trim().length >= 2 && search.data?.length === 0 && <Text c="dimmed" ta="center" py="sm">Nobody matches “{debouncedQ}”.</Text>}
            </Stack>
          )}

          <Group justify="space-between" mt="md" pt="md" className={classes.autoRow}>
            <div><Text fw={600}>Auto-mark served</Text><Text size="xs" c="dimmed">Record the meal as soon as someone is eligible</Text></div>
            <Switch size="lg" checked={auto} onChange={(e) => toggleAuto(e.currentTarget.checked)} aria-label="Auto-mark served" />
          </Group>
        </Card>

        {/* result side: on phones it sits above the input once there is a result */}
        <Stack gap="md" className={classes.resultSide} data-has-result={!!result || undefined}>
          {verifying.error && <Alert color="red">{errorMessage(verifying.error)}</Alert>}
          <ResultCard r={result} serving={verifying.isLoading} onServe={serveNow} onNext={next} />
          <Card>
            <Group justify="space-between" mb="xs"><Text fw={600}>Recently served</Text><Button component={Link} to="/counter/today" variant="subtle" size="xs">View all</Button></Group>
            {recent.data?.length ? recent.data.map((m) => (
              <Group key={m.emp_code + m.served_at} wrap="nowrap" py={6}>
                <Avatar radius="xl" size="sm" color="brand">{initials(m.name)}</Avatar>
                <Text size="sm" fw={500} style={{ flex: 1 }} truncate>{m.name} <Text span c="dimmed" size="xs">{m.emp_code}</Text></Text>
                <Text size="xs" c="dimmed">{time(m.served_at)}</Text>
              </Group>
            )) : <Text size="sm" c="dimmed">No meals served yet today.</Text>}
          </Card>
        </Stack>
      </div>

    </Stack>
  )
}
