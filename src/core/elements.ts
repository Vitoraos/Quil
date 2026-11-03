import { z } from 'zod'
import { assetIdSchema, pageIdSchema } from './ids'
import {
  alignValue,
  colorValue,
  fitValue,
  fontSizeValue,
  fontWeightValue,
  radiusValue,
  shadowValue,
  spacingValue,
  textValue
} from './values'

export const elementKinds = ['heading', 'text', 'image', 'button', 'card', 'navigation', 'form'] as const
export type ElementKind = (typeof elementKinds)[number]
export type NodeKind = ElementKind | 'section'

export const sectionPropsSchema = z
  .object({
    bgColor: colorValue.optional(),
    padding: spacingValue.optional()
  })
  .strict()

export const headingPropsSchema = z
  .object({
    text: textValue,
    level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
    color: colorValue.optional(),
    fontSize: fontSizeValue.optional(),
    fontWeight: fontWeightValue.optional(),
    align: alignValue.optional()
  })
  .strict()

export const textPropsSchema = z
  .object({
    text: textValue,
    fontSize: fontSizeValue.optional(),
    color: colorValue.optional(),
    lineHeight: z.number().finite().min(1).max(3).optional(),
    align: alignValue.optional()
  })
  .strict()

export const imagePropsSchema = z
  .object({
    assetId: assetIdSchema,
    alt: textValue,
    fit: fitValue,
    width: z.number().finite().min(1).max(10000).optional(),
    height: z.number().finite().min(1).max(10000).optional()
  })
  .strict()

export const buttonPropsSchema = z
  .object({
    label: textValue,
    bgColor: colorValue,
    textColor: colorValue,
    radius: radiusValue.optional(),
    fontWeight: fontWeightValue.optional()
  })
  .strict()

export const cardPropsSchema = z
  .object({
    bgColor: colorValue.optional(),
    radius: radiusValue.optional(),
    padding: spacingValue.optional(),
    shadow: shadowValue.optional()
  })
  .strict()

export const navigationPropsSchema = z
  .object({
    items: z.array(z.object({ label: textValue, pageId: pageIdSchema }).strict()).max(20),
    bgColor: colorValue.optional()
  })
  .strict()

export const formPropsSchema = z
  .object({
    submitLabel: textValue,
    fields: z.array(z.object({ label: textValue, type: z.enum(['text', 'email', 'password']) }).strict()).max(20),
    bgColor: colorValue.optional()
  })
  .strict()

export const propsSchemas = {
  section: sectionPropsSchema,
  heading: headingPropsSchema,
  text: textPropsSchema,
  image: imagePropsSchema,
  button: buttonPropsSchema,
  card: cardPropsSchema,
  navigation: navigationPropsSchema,
  form: formPropsSchema
} as const
