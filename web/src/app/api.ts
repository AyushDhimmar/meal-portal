import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { toAppError, type AppError } from '../lib/errors'

/**
 * The single RTK Query API. Every feature adds its endpoints with api.injectEndpoints (see
 * features/<name>/api.ts). Calls go through supabase-js, so there is no HTTP base URL here.
 *
 * Tags = what a mutation invalidates. A save that changes employees invalidates 'Employee',
 * and every query that provides 'Employee' refetches. This list is the app's cache map.
 */
const TAGS = [
  'Profile', 'Employee', 'Cycle', 'CycleDefaults', 'Holiday', 'Enrollment',
  'MyHome', 'MyHistory', 'Counter', 'Day', 'Bill', 'Audit', 'Setting',
] as const

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery<AppError>(),
  tagTypes: TAGS,
  refetchOnFocus: false,
  endpoints: () => ({}),
})

type SbResponse = { data: unknown; error: unknown }
/** What an RTK Query queryFn returns. */
type Result<T> = { data: T; error?: undefined } | { error: AppError; data?: undefined }

/** The data type of a successful supabase-js response (a list, a row, or `X | null` for maybeSingle). */
type OkData<R> = R extends { error: null; data: infer D } ? D : never

/**
 * Runs a supabase-js call and returns RTK Query's { data } | { error } with a friendly AppError.
 * The row type comes from the generated database types.
 */
export async function sb<R extends { data: unknown; error: unknown }>(call: PromiseLike<R>): Promise<Result<OkData<R>>> {
  try {
    const { data, error } = await call
    return error ? { error: toAppError(error) } : { data: data as OkData<R> }
  } catch (e) {
    return { error: toAppError(e) }
  }
}

/**
 * Same as sb, for database functions that return jsonb: the generated type is just `Json`,
 * so the caller must state the shape: sbJson<Shape>(...) (kept next to the endpoint, matching the SQL).
 */
export async function sbJson<R>(call: PromiseLike<SbResponse>): Promise<Result<NoInfer<R>>> {
  try {
    const { data, error } = await call
    return error ? { error: toAppError(error) } : { data: data as R }
  } catch (e) {
    return { error: toAppError(e) }
  }
}

/**
 * Views: Postgres can't tell the type generator which view columns are never null, so every
 * column comes out `| null`. For views whose columns are known to be filled (checked in SQL),
 * sbView strips the nulls from the row type.
 */
export type NotNull<T> = { [K in keyof T]: NonNullable<T[K]> }
export async function sbView<R extends { data: unknown; error: unknown }>(call: PromiseLike<R>): Promise<Result<NotNull<OkData<R> extends (infer Row)[] ? Row : never>[]>> {
  const res = await sb(call)
  return res.error ? { error: res.error } : { data: res.data as never }
}

/** Postgres function arguments can be null, but the generated types can't say so. */
export const nullable = <T,>(v: T | null) => v as T
