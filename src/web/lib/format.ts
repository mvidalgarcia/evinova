/** Enum values use underscores (e.g. feature_request); show them as words. */
export const humanize = (value: string): string => value.replaceAll("_", " ");
