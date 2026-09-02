/** Password policy (ported from password-policy.ts). */

export const DEFAULT_PASSWORD_POLICY = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSymbol: false,
};

export function checkPassword(password, policy) {
  const violations = [];
  if (password.length < policy.minLength) violations.push('too-short');
  if (policy.requireUppercase && !/[A-Z]/.test(password)) violations.push('missing-uppercase');
  if (policy.requireLowercase && !/[a-z]/.test(password)) violations.push('missing-lowercase');
  if (policy.requireDigit && !/\d/.test(password)) violations.push('missing-digit');
  if (policy.requireSymbol && !/[^\p{L}\p{N}]/u.test(password)) violations.push('missing-symbol');
  return violations;
}
