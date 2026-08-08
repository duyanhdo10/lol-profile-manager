import type { CSSProperties } from 'react';

type CssVariableName = `--${string}`;

export function cssVariables(values: Partial<Record<CssVariableName, string | number>>): CSSProperties {
  return values as CSSProperties;
}
