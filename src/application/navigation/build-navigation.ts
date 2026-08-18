import 'server-only';

import { can, type AuthenticatedUser } from '@/domain/auth/authorization';
import {
  NAV_GROUPS,
  NAV_ITEMS,
  type NavGroupId,
  type NavItem,
} from '@/domain/navigation/navigation';

/**
 * Builds the navigation for a signed-in user, server-side (ADR-031).
 *
 * Entries the user cannot open are not sent to the browser at all — not hidden with CSS,
 * not filtered on the client. A group with nothing left in it disappears with its heading
 * rather than leaving an empty label.
 */
export interface VisibleNavGroup {
  id: NavGroupId;
  items: NavItem[];
}

export function buildNavigation(user: AuthenticatedUser): VisibleNavGroup[] {
  return NAV_GROUPS.map((group) => ({
    id: group,
    items: NAV_ITEMS.filter(
      (item) =>
        item.group === group &&
        // Content pages are read at the organizational level the user holds; the page
        // itself re-checks with the specific target once it has one.
        (can(user, item.requires.action, item.requires.resource) || canWithinAnyScope(user, item)),
    ),
  })).filter((group) => group.items.length > 0);
}

/**
 * A unit-scoped role holds its permissions inside its perimeter, not globally, so a
 * global check alone would hide every entry from a manager. This asks whether the
 * permission is held *anywhere*.
 */
function canWithinAnyScope(user: AuthenticatedUser, item: NavItem): boolean {
  return user.assignments.some((assignment) => {
    if (assignment.scope.kind === 'ORGANIZATION_UNIT') {
      const unitId = assignment.scope.organizationUnitIds?.[0];
      return (
        unitId !== undefined &&
        can(user, item.requires.action, item.requires.resource, { organizationUnitId: unitId })
      );
    }
    if (assignment.scope.kind === 'SELF') {
      return can(user, item.requires.action, item.requires.resource, { ownerUserId: user.id });
    }
    return false;
  });
}

export function canOpen(user: AuthenticatedUser, item: NavItem): boolean {
  return can(user, item.requires.action, item.requires.resource) || canWithinAnyScope(user, item);
}
