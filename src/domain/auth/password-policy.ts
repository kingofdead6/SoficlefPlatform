/**
 * Password policy. Configurable rather than hardcoded (ADR-012, CDC v0.1 §2.1): SOFICLEF
 * IT security may impose its own values, and this module only knows how to apply them.
 */

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSymbol: false,
};

export type PasswordViolation =
  'too-short' | 'missing-uppercase' | 'missing-lowercase' | 'missing-digit' | 'missing-symbol';

/** Returns every violation, so the UI can show all of them at once rather than one by one. */
export function checkPassword(password: string, policy: PasswordPolicy): PasswordViolation[] {
  const violations: PasswordViolation[] = [];
  if (password.length < policy.minLength) violations.push('too-short');
  if (policy.requireUppercase && !/[A-Z]/.test(password)) violations.push('missing-uppercase');
  if (policy.requireLowercase && !/[a-z]/.test(password)) violations.push('missing-lowercase');
  if (policy.requireDigit && !/\d/.test(password)) violations.push('missing-digit');
  if (policy.requireSymbol && !/[^\p{L}\p{N}]/u.test(password)) violations.push('missing-symbol');
  return violations;
}
