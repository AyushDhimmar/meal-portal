import { Button, Card, Center, Stack, Text, Title } from '@mantine/core'
import { useAuth } from './useAuth'

export function NotOnListPage() {
  const { user, signOut } = useAuth()
  return (
    <Center mih="100vh" p="md">
      <Card maw={420} w="100%">
        <Stack>
          <Title order={2} size="h3">You're not on the lunch list yet</Title>
          <Text c="dimmed">
            You signed in as <b>{user?.email}</b>, but there is no active employee with this email.
            Ask an Admin to add you, then sign in again.
          </Text>
          <Button variant="default" onClick={signOut}>Sign out</Button>
        </Stack>
      </Card>
    </Center>
  )
}
