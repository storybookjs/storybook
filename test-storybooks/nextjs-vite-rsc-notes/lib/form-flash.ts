import type { z } from "zod";
import { getFlashCookie, setFlashCookie } from "#lib/flash-cookie.ts";

const FORM_FLASH_KEY = "form";
const SENSITIVE_FIELD_PATTERN = /password|token|secret|authorization|auth|csrf|otp/i;

type FieldName<TSchema extends z.ZodType> = Extract<keyof z.output<TSchema>, string>;
type FieldValue<TSchema extends z.ZodType, TName extends FieldName<TSchema>, TArray, TScalar> =
  NonNullable<z.output<TSchema>[TName]> extends readonly unknown[] ? TArray : TScalar;
type OldValue<TSchema extends z.ZodType, TName extends FieldName<TSchema>> = FieldValue<
  TSchema,
  TName,
  string[] | undefined,
  string | undefined
>;
type ErrorValue<TSchema extends z.ZodType, TName extends FieldName<TSchema>> = FieldValue<
  TSchema,
  TName,
  string[] | undefined,
  string | undefined
>;
type OldValues<TSchema extends z.ZodType> = {
  [TName in FieldName<TSchema>]: OldValue<TSchema, TName>;
};
type ErrorValues<TSchema extends z.ZodType> = {
  [TName in FieldName<TSchema>]: ErrorValue<TSchema, TName>;
};

type FieldErrors = Record<string, string[] | undefined>;
type OldInput = Record<string, string | string[] | undefined>;

type FormFlash = {
  errors: FieldErrors;
  old: OldInput;
};

export type FlashedForm<TSchema extends z.ZodType> = {
  old: OldValues<TSchema>;
  errors: ErrorValues<TSchema>;
};

type FormOptions<TSchema extends z.ZodType> = {
  id?: string;
  except?: Array<FieldName<TSchema>>;
};

export function formFlashKey(id?: string) {
  return id ? `${FORM_FLASH_KEY}:${id}` : FORM_FLASH_KEY;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isFieldRecord<T>(
  value: unknown,
  isFieldValue: (fieldValue: unknown) => fieldValue is T,
): value is Record<string, T> {
  return isRecord(value) && Object.values(value).every(isFieldValue);
}

function isErrorValue(value: unknown): value is FieldErrors[string] {
  return value === undefined || isStringArray(value);
}

function isOldValue(value: unknown): value is OldInput[string] {
  return value === undefined || typeof value === "string" || isStringArray(value);
}

function isFormFlash(value: unknown): value is FormFlash {
  return (
    isRecord(value) &&
    isFieldRecord(value.errors, isErrorValue) &&
    isFieldRecord(value.old, isOldValue)
  );
}

function emptyFlash(): FormFlash {
  return { errors: {}, old: {} };
}

function encodeFlash(flash: FormFlash) {
  return encodeURIComponent(JSON.stringify(flash));
}

function decodeFlash(value: string | null): FormFlash {
  if (!value) return emptyFlash();

  try {
    const decoded = JSON.parse(decodeURIComponent(value)) as unknown;
    return isFormFlash(decoded) ? decoded : emptyFlash();
  } catch {
    return emptyFlash();
  }
}

function collectOldInput<TSchema extends z.ZodType>(
  formData: FormData,
  options: FormOptions<TSchema> = {},
) {
  const old: OldInput = {};
  const skippedFields = new Set<string>(options.except ?? []);

  for (const [name, value] of formData) {
    if (name.startsWith("$ACTION_")) continue;
    if (skippedFields.has(name) || SENSITIVE_FIELD_PATTERN.test(name)) continue;
    if (typeof value !== "string") continue;

    const existing = old[name];
    if (existing === undefined) {
      old[name] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      old[name] = [existing, value];
    }
  }

  return old;
}

function fieldProxy<TValues extends object>(getValue: (name: string) => unknown): TValues {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- Field types are resolved lazily from the schema-backed property name.
  return new Proxy(
    {},
    { get: (_target, name) => (typeof name === "string" ? getValue(name) : undefined) },
  ) as TValues;
}

function makeForm<TSchema extends z.ZodType>(flash: FormFlash): FlashedForm<TSchema> {
  return {
    old: fieldProxy<OldValues<TSchema>>((name) => flash.old[name]),
    errors: fieldProxy<ErrorValues<TSchema>>((name) => {
      const messages = flash.errors[name];
      return Array.isArray(flash.old[name]) ? messages : messages?.[0];
    }),
  };
}

export async function getForm<TSchema extends z.ZodType>(
  _schema: TSchema,
  options: FormOptions<TSchema> = {},
): Promise<FlashedForm<TSchema>> {
  const value = await getFlashCookie(formFlashKey(options.id));
  return makeForm(decodeFlash(value));
}

export async function setForm<TSchema extends z.ZodType>(
  schema: TSchema,
  formData: FormData,
  options: FormOptions<TSchema> = {},
): Promise<z.ZodSafeParseResult<z.output<TSchema>>> {
  const result = schema.safeParse(formData);

  if (!result.success) {
    await setFlashCookie(
      formFlashKey(options.id),
      encodeFlash({
        errors: result.error.flatten().fieldErrors,
        old: collectOldInput(formData, options),
      }),
    );
  }

  return result;
}
