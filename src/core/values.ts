import { z } from 'zod'

export const colorRegex = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i
export const oklchRegex = /^oklch\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\s*\)$/

export const colorValue = z
  .string()
  .refine((v) => colorRegex.test(v) || oklchRegex.test(v), 'must be a hex or oklch colour')

export const fontSizeValue = z
  .object({
    value: z.number().finite().min(1).max(512),
    unit: z.enum(['px', 'rem'])
  })
  .strict()

export const spacingValue = z
  .object({ value: z.number().finite().min(0).max(4096) })
  .strict()

export const radiusValue = z.number().finite().min(0).max(256)

export const fontWeightValue = z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700), z.literal(800)])

export const alignValue = z.enum(['left', 'center', 'right', 'justify'])
export const fitValue = z.enum(['cover', 'contain', 'fill'])
export const shadowValue = z.enum(['shadow-1', 'shadow-2', 'shadow-3'])

const controlChars = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/

export const textValue = z
  .string()
  .max(10000)
  .refine((v) => !controlChars.test(v), 'text contains control characters')

export const shortTextValue = z
  .string()
  .min(1)
  .max(280)
  .refine((v) => !controlChars.test(v), 'text contains control characters')

export const briefValue = z
  .string()
  .min(1)
  .max(5000)
  .refine((v) => !controlChars.test(v), 'brief contains control characters')
