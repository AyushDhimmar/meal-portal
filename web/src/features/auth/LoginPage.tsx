import { useState, type FormEvent } from 'react'
import { Alert, Anchor, Button, Card, Center, PasswordInput, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core'
import { IconAlertCircle, IconToolsKitchen2 } from '@tabler/icons-react'
import { signInMethod } from './signInMethod'

export function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = mode === 'signin'
      ? await signInMethod.signIn(email, password)
      : await signInMethod.signUp(email, password)
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <Center mih="100vh" p="md" style={{ background: 'linear-gradient(180deg, #E8F5F1 0%, #F6F8FA 55%)' }}>
      <Stack w="100%" maw={400} gap="lg">
        <Stack align="center" gap={6}>
          <ThemeIcon size={56} radius="lg"><IconToolsKitchen2 size={30} /></ThemeIcon>
          <Title order={1} size="h2">Meal Portal</Title>
          <Text c="dimmed" ta="center">Subsidised lunch: opt in, verify and report in one place.</Text>
        </Stack>

        <Card shadow="sm">
          <form onSubmit={submit}>
            <Stack>
              {error && <Alert color="red" icon={<IconAlertCircle size={18} />}>{error}</Alert>}
              <TextInput label="Work email" placeholder="you@1rivet.com" type="email" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.currentTarget.value)} required />
              <PasswordInput label="Password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password} onChange={(e) => setPassword(e.currentTarget.value)} required minLength={6} />
              <Button type="submit" size="lg" loading={busy} fullWidth>
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
              <Text size="sm" ta="center">
                {mode === 'signin' ? 'First time here? ' : 'Already have an account? '}
                <Anchor component="button" type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}>
                  {mode === 'signin' ? 'Create an account' : 'Sign in'}
                </Anchor>
              </Text>
            </Stack>
          </form>
        </Card>

        <Text size="xs" c="dimmed" ta="center">
          Development sign-in. Company sign-in (Microsoft or IAM) will replace this. Only @1rivet.com accounts are accepted.
        </Text>
      </Stack>
    </Center>
  )
}
