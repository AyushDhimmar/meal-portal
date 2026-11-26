import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { api } from './api'
import { authSlice } from '../features/auth/authSlice'

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    [authSlice.name]: authSlice.reducer,
  },
  middleware: (getDefault) => getDefault().concat(api.middleware),
})
setupListeners(store.dispatch)   // refetch on reconnect

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
