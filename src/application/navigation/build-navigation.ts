import 'server-only';

import { canAnyScope, type AuthenticatedUser } from '@/domain/auth/authorization';
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
        // Whether the entry is worth showing is "do they hold this permission anywhere",
        // not "do they hold it on some particular row" — the nav has no target yet. The
        // page re-checks with the real target once it has one (ADR-020).
        canAnyScope(user, item.requires.action, item.requires.resource),
    ),
  })).filter((group) => group.items.length > 0);
}

/**
 * May this user open this route at all?
 *
 * Deliberately the same question `buildNavigation` asks, so the sidebar and the boundary
 * can never disagree. They used to: the nav asked "anywhere", while some loaders asked
 * "on your own row", which offered HR a training catalogue that then refused to load.
 */
export function canOpen(user: AuthenticatedUser, item: NavItem): boolean {
  return canAnyScope(user, item.requires.action, item.requires.resource);
}
