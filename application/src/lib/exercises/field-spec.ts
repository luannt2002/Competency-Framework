/**
 * Declarative field specs — how a tenant describes a new exercise kind
 * without writing code.
 *
 * `exercise_types.payload_schema` / `.answer_schema` hold a `FieldSpec`:
 * a flat list of typed fields. `buildZodFromSpec` turns that JSON into a real
 * zod schema, so an authored payload is validated exactly as strictly as a
 * built-in one — the difference is that the rules arrived as data.
 *
 * Marking a field `secret: true` is how a tenant says "this holds the answer";
 * `secretFieldsOf` feeds those keys straight into `sanitizePayload`.
 *
 * Pure module: no DB, no React.
 */
import { z } from 'zod';

export const FIELD_TYPES = [
  'string',
  'text',
  'markdown',
  'number',
  'boolean',
  'string_list',
  'option_list',
  'json',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** One authored field. `key` becomes a property of the payload object. */
export const fieldDescriptorSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(48)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'key must be a plain identifier'),
  label: z.string().min(1).max(120),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().default(false),
  /** Never serialized to a client. This is the tenant-facing "answer" flag. */
  secret: z.boolean().default(false),
  help: z.string().max(500).optional(),
});
export type FieldDescriptor = z.infer<typeof fieldDescriptorSchema>;

export const fieldSpecSchema = z.object({
  fields: z.array(fieldDescriptorSchema).max(50).default([]),
});
export type FieldSpec = z.infer<typeof fieldSpecSchema>;

/** An `option_list` entry — the shape used by choice-style custom kinds. */
const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
});

function zodForType(type: FieldType): z.ZodTypeAny {
  switch (type) {
    case 'string':
    case 'text':
    case 'markdown':
      return z.string();
    case 'number':
      return z.number();
    case 'boolean':
      return z.boolean();
    case 'string_list':
      return z.array(z.string());
    case 'option_list':
      return z.array(optionSchema);
    case 'json':
      return z.unknown();
  }
}

/**
 * Compile a spec into a zod object schema.
 *
 * Optional fields are `.optional()`, not defaulted — an absent optional field
 * stays absent so sanitisation and diffing stay honest. Unknown keys are
 * stripped (zod's default) rather than rejected, so an engine's own config
 * keys can ride along in the same payload.
 */
export function buildZodFromSpec(spec: FieldSpec): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of spec.fields) {
    const base = zodForType(f.type);
    shape[f.key] = f.required ? base : base.optional();
  }
  return z.object(shape);
}

/** Keys a tenant flagged secret — feed directly to `sanitizePayload`. */
export function secretFieldsOf(spec: FieldSpec): string[] {
  return spec.fields.filter((f) => f.secret).map((f) => f.key);
}

/**
 * Parse an untrusted JSONB value into a `FieldSpec`.
 * Anything unparseable degrades to an empty spec rather than throwing — a
 * malformed stored spec must not take down the lesson runner.
 */
export function parseFieldSpec(value: unknown): FieldSpec {
  const parsed = fieldSpecSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : { fields: [] };
}
