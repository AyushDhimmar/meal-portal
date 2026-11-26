import { z } from 'zod'
import { dateSchema, pricePaiseSchema, timeSchema, toPaise, weekdaysSchema } from '../../lib/schemas'

/** Same rules as admin_save_cycle(). Price is typed in rupees and stored in paise. */
export const cycleSchema = z.object({
  month: dateSchema,
  weekdays: weekdaysSchema,
  price: z.union([z.number(), z.string()]).transform(toPaise).pipe(pricePaiseSchema),
  optin_open: dateSchema,
  optin_close: dateSchema,
  serve_start: timeSchema,
  serve_end: timeSchema,
}).superRefine((v, ctx) => {
  if (v.optin_close < v.optin_open) ctx.addIssue({ code: 'custom', path: ['optin_close'], message: 'Must be on or after the day opt-in opens' })
  else if (v.optin_close >= v.month) ctx.addIssue({ code: 'custom', path: ['optin_close'], message: 'Must be before the lunch month starts' })
  if (v.serve_end <= v.serve_start) ctx.addIssue({ code: 'custom', path: ['serve_end'], message: 'Must be after serving starts' })
})
export type CycleFormValues = z.input<typeof cycleSchema>

/** Rules that may still change after a cycle closes (with a reason): admin_update_cycle(). */
export const rulesSchema = z.object({
  weekdays: weekdaysSchema,
  price: z.union([z.number(), z.string()]).transform(toPaise).pipe(pricePaiseSchema),
  serve_start: timeSchema,
  serve_end: timeSchema,
}).refine((v) => v.serve_end > v.serve_start, { path: ['serve_end'], message: 'Must be after serving starts' })
export type RulesFormValues = z.input<typeof rulesSchema>
