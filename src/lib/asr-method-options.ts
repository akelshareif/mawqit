/** Asr juristic method options for setup; values map to adhan's `Madhab` in prayer-times.ts. */
export const ASR_METHOD_OPTIONS = [
  {
    value: "standard",
    label: "Standard",
    description: "Shafi, Maliki, Hanbali — shadow length 1×",
  },
  {
    value: "hanafi",
    label: "Hanafi",
    description: "Shadow length 2× (later Asr)",
  },
] as const;

export type AsrMethodValue = (typeof ASR_METHOD_OPTIONS)[number]["value"];

const ALLOWED = new Set<string>(ASR_METHOD_OPTIONS.map((o) => o.value));

export function isAllowedAsrMethod(value: string): value is AsrMethodValue {
  return ALLOWED.has(value);
}
