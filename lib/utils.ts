import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const countSyllables = (text: string): number => {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z]/g, "")
      .match(/[aeiouy]+/g)?.length || 1
  );
};