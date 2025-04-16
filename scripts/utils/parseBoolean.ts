export function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return defaultValue;
  }
  