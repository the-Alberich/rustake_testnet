import * as chrono from "chrono-node";
import { parse as parseISODuration, toSeconds } from "iso8601-duration";

export type DurationOrTimestamp = string;

const DURATION_REGEX = /^(\d+)\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?)$/i;

const UNIT_TO_SECONDS: Record<string, number> = {
  second: 1,
  seconds: 1,
  minute: 60,
  minutes: 60,
  hour: 3600,
  hours: 3600,
  day: 86400,
  days: 86400,
  week: 604800,
  weeks: 604800,
  month: 2592000,  // Approximation
  months: 2592000,
  year: 31536000,
  years: 31536000,
};

// Parses a duration string and returns the number of seconds.
//  - Supports ISO 8601 duration ("P1W") and natural language ("2 weeks").
export function parseDuration(input: string): number {
  if (!input || typeof input !== "string") {
    throw new Error("Invalid duration input");
  }

  // Try ISO 8601 duration.
  try {
    const isoDuration = parseISODuration(input);
    const seconds = toSeconds(isoDuration);
    if (seconds > 0) return seconds;
  } catch {
    // Fallback
  }

  // Try natural language duration.
  const now = new Date();
  const parsedDate = chrono.parseDate(input, now);
  if (parsedDate) {
    const deltaMs = parsedDate.getTime() - now.getTime();
    if (deltaMs > 0) return Math.floor(deltaMs / 1000);
  }

  // Fallback regex: "2 weeks", "3 days"
  const match = input.trim().match(DURATION_REGEX);
  if (match) {
    const [, countStr, unitRaw] = match;
    const unit = unitRaw.toLowerCase();
    const seconds = parseInt(countStr, 10) * (UNIT_TO_SECONDS[unit] ?? 0);
    if (seconds > 0) return seconds;
  }

  throw new Error(`Could not parse duration string: "${input}"`);
}

// Parses a timestamp string (e.g. ISO 8601 datetime) and returns UNIX timestamp in seconds.
export function parseTimestamp(input: string): number {
  if (!input || typeof input !== "string") {
    throw new Error("Invalid timestamp input");
  }

  const parsed = Date.parse(input);
  if (!isNaN(parsed)) {
    return Math.floor(parsed / 1000);
  }

  throw new Error(`Could not parse timestamp string: "${input}"`);
}

// Infers a duration in seconds from input.
// - If duration: returns duration.
// - If timestamp: returns delta between timestamp and baseTime (default: now).
// - Throws if timestamp is before baseTime.
export async function inferDuration(
    input: DurationOrTimestamp,
    baseTime: number = Math.floor(Date.now() / 1000)
): Promise<number> {
    try {
        const duration = await parseDuration(input);
        return duration;
    } catch {
        // not a duration — try timestamp
    }

    try {
        const targetTime = parseTimestamp(input);
        const delta = targetTime - baseTime;
        if (delta < 0) {
            throw new Error(`Timestamp "${input}" is before base time (${baseTime}); cannot infer a negative duration.`);
        }
        return delta;
    } catch (err) {
        throw new Error(`Could not infer duration from "${input}": ${(err as Error).message}`);
    }
}

// Infers a future timestamp from input.
// - If input is timestamp: returns the timestamp.
// - If input is duration: adds to baseTime (default: now) and returns timestamp.
export async function inferTimestamp(
    input: DurationOrTimestamp,
    baseTime: number = Math.floor(Date.now() / 1000)
): Promise<number> {
    try {
        const timestamp = parseTimestamp(input);
        return timestamp;
    } catch {
        // not a timestamp — try duration
    }

    try {
        const duration = await parseDuration(input);
        return baseTime + duration;
    } catch (err) {
        throw new Error(`Could not infer timestamp from "${input}": ${(err as Error).message}`);
    }
}
