import { z } from 'zod'
import { pricePaiseSchema, timeSchema, toPaise, weekdaysSchema } from '../../lib/schemas'

/** Same checks as admin_save_setting(); the form shows them on the field before saving. */

const dayOfMonth = z.number({ error: 'Enter a day' }).int().min(1, 'Between 1 and 28').max(28, 'Between 1 and 28')

export const cycleDefaultsSchema = z.object({
  weekdays: weekdaysSchema,
  price: z.union([z.number(), z.string()]).transform(toPaise).pipe(pricePaiseSchema),
  optin_open_day: dayOfMonth,
  optin_close_day: dayOfMonth,
  serve_start: timeSchema,
  serve_end: timeSchema,
  enforce_serving_window: z.boolean(),
  billing_basis: z.enum(['opted', 'consumed']),
}).superRefine((v, ctx) => {
  if (v.optin_close_day <= v.optin_open_day) ctx.addIssue({ code: 'custom', path: ['optin_close_day'], message: 'Must be after the opening day' })
  if (v.serve_end <= v.serve_start) ctx.addIssue({ code: 'custom', path: ['serve_end'], message: 'Must be after serving starts' })
}).transform(({ price, ...rest }) => ({ ...rest, price_paise: price }))   // the form edits rupees; the setting stores paise

export const monthlyEmailSchema = z.object({
  enabled: z.boolean(),
  day: dayOfMonth,
  time: timeSchema,
  recipients: z.string(),
})

export const jobsSchema = z.object({
  fallback_list_time: timeSchema,
  nightly_backup_time: timeSchema,
  backup_retention_days: z.number({ error: 'Enter a number of days' }).int().min(7, 'Between 7 and 365 days').max(365, 'Between 7 and 365 days'),
})
