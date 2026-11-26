import { z } from 'zod'

/** Shared validation rules used by several forms. The database enforces the same rules. */

/** Reason recorded in the audit log for overrides and changes after closing (private.require_reason). */
export const reasonSchema = z.string().trim().min(5, 'At least 5 characters')

export const weekdaysSchema = z.array(z.number().int().min(0).max(6)).min(1, 'Choose at least one lunch weekday')
export const pricePaiseSchema = z.number({ error: 'Enter a price' }).int().min(100, 'Price must be at least ₹1').max(100000, 'Price must be at most ₹1,000')
export const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Choose a time')
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date')

/** Rupees typed in a form → paise stored in the database. */
export const toPaise = (rupees: number | string) => Math.round(Number(rupees) * 100)
