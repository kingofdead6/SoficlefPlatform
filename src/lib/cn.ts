import clsx, { type ClassValue } from 'clsx';

/** Conditional class names. Kept in one place so components read the same way. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
