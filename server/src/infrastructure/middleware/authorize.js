import { ForbiddenError, assertCan, assertCanAnyScope } from '../../domain/auth/authorization.js';

/**
 * Wraps domain can()/assertCan() as Express middleware.
 *
 * `resolveTarget(req)` derives the TargetScope (organizationUnitId / ownerUserId) from
 * the request — e.g. from a resolved row, from req.params, or from req.user for
 * self-owned resources. Omit it for resources with no organizational anchor (use
 * `authorizeAnyScope` for shared reference content instead).
 */
export function authorize(action, resource, resolveTarget) {
  return async (req, res, next) => {
    try {
      const target = resolveTarget ? await resolveTarget(req) : undefined;
      assertCan(req.user, action, resource, target);
      next();
    } catch (error) {
      if (error instanceof ForbiddenError) return res.status(403).json({ error: 'forbidden' });
      next(error);
    }
  };
}

export function authorizeAnyScope(action, resource) {
  return (req, res, next) => {
    try {
      assertCanAnyScope(req.user, action, resource);
      next();
    } catch (error) {
      if (error instanceof ForbiddenError) return res.status(403).json({ error: 'forbidden' });
      next(error);
    }
  };
}
