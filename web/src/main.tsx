import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { Provider } from 'react-redux'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './global.css'
import { theme } from './theme'
import { store } from './app/store'
import { AuthSync } from './features/auth/AuthSync'
import { ErrorBoundary } from './components/ErrorBoundary'
import App from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <Notifications position="top-center" />
      <ErrorBoundary page>
        <Provider store={store}>
          <AuthSync />
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </Provider>
      </ErrorBoundary>
    </MantineProvider>
  </StrictMode>,
)
