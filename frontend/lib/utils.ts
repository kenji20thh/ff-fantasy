import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;

    for (const key of [
      "data",
      "teams",
      "players",
      "rooms",
      "stats",
      "entries",
      "leaderboard",
      "days",
    ]) {
      if (Array.isArray(v[key])) {
        return v[key] as T[];
      }
    }
  }

  return [];
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}