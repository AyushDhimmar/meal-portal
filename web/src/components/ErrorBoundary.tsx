import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Card, Center, Code, Stack, Text, Title } from '@mantine/core'

type Props = { children: ReactNode; /** full-page fallback (outside the app layout) */ page?: boolean }
type State = { error: Error | null }

/** Shows a friendly screen instead of a blank page when a screen crashes. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed', error, info.componentStack)   // the place to report to monitoring later
  }

  render() {
    if (!this.state.error) return this.props.children
    const card = (
      <Card maw={460} w="100%" padding="lg">
        <Stack>
          <Title order={3}>Something went wrong on this screen</Title>
          <Text c="dimmed" size="sm">Your data is safe. Reload the page; if it keeps happening, send this message to the team:</Text>
          <Code block>{this.state.error.message}</Code>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </Stack>
      </Card>
    )
    return this.props.page ? <Center mih="100vh" p="md">{card}</Center> : <Center py="xl">{card}</Center>
  }
}
