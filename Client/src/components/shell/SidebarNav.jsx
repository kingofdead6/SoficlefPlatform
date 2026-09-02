import { NavLink } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext.jsx';
import { can, hasRole } from '../../lib/permissions.js';
import { NAV_GROUP_LABELS, NAV_ITEMS } from '../../lib/navigation.js';
import { cn } from '../../lib/cn.js';

export function SidebarNav() {
  const { user } = useAuth();
  if (!user) return null;

  /*
   * Each role portal is its own section of the route guide, and only that section:
   * SI/administrator sees /admin/* (§2.4), a manager /app/manager/* (§2.2), an HR user
   * /app/hr/* (§2.3). None of them should get the steering/direction/references/tools
   * groups their permissions would otherwise unlock — those are cross-cutting pages, not
   * part of any one portal. ADMIN in particular holds nearly every permission in the
   * catalogue, so without this it sees the entire nav tree.
   *
   * Scoping needs a *single* portal to scope to. An account holding two portal roles
   * (say MANAGER and HR) is shown everything, because no one section covers it — better
   * a crowded sidebar than a hidden page someone needs.
   *
   * EMPLOYEE is listed last on purpose. Every portal role also carries EMPLOYEE-level
   * permissions, and §2.2 says a manager keeps everything under /app/me — so the higher
   * portal must win the scope, and EMPLOYEE only decides it for someone who holds nothing
   * else. Without this entry a new hire fell through to the whole tree: §2.1's "cannot do"
   * list is explicit that they get no HR or SI configuration and no other employee's data.
   */
  const portalRoles = [
    ['ADMIN', 'administration'],
    ['HR', 'hr'],
    ['MANAGER', 'manager'],
    ['EMPLOYEE', 'me'],
  ].filter(([role]) => hasRole(user, role));

  /*
   * The highest portal role wins. Two *portal* roles (MANAGER + HR, say) still show the
   * whole tree, since no one section of the guide covers that person; EMPLOYEE alongside
   * a portal role is not that case — it is the normal state of every manager.
   */
  const portalOnly = portalRoles.filter(([role]) => role !== 'EMPLOYEE');
  const portalGroup =
    portalOnly.length > 1 ? null : (portalOnly[0] ?? portalRoles[0])?.[1] ?? null;

  const scoped = portalGroup ? NAV_ITEMS.filter((item) => item.group === portalGroup) : NAV_ITEMS;
  const visible = scoped.filter((item) => can(user, item.requires.action, item.requires.resource));
  const byGroup = new Map();
  for (const item of visible) {
    if (!byGroup.has(item.group)) byGroup.set(item.group, []);
    byGroup.get(item.group).push(item);
  }

  const initials = (user.displayName ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <nav className="sticky top-0 flex h-screen w-[var(--sidebar-w)] shrink-0 flex-col border-e border-border bg-surface">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-8 w-8 place-items-center rounded-app bg-red-brand font-display text-sm text-white">
          S
        </span>
        <span className="font-display text-lg leading-none text-red-deep">SOFICLEF</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {[...byGroup.entries()].map(([group, items]) => (
          <div key={group} className="mb-5">
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-dim/70">
              {NAV_GROUP_LABELS[group] ?? group}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.href}
                  /*
                   * `end` stops a parent route (/app/manager, /app/me, /admin …) from
                   * staying highlighted on every one of its children — NavLink matches by
                   * prefix otherwise, so two links lit up at once.
                   */
                  end={item.end ?? false}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center rounded-app py-2 pe-3 ps-4 text-sm transition-colors duration-150',
                      isActive ? 'bg-red-brand/8 text-red-brand' : 'text-text-muted hover:bg-surface-2 hover:text-text',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'absolute inset-y-1.5 start-0 w-[3px] rounded-full transition-all duration-200',
                          isActive ? 'bg-red-brand opacity-100' : 'bg-red-brand opacity-0',
                        )}
                      />
                      {/*
                        The label is always rendered at its final (medium) weight in an
                        invisible sizing layer, so switching the visible weight on active
                        can never change the link's width and shove the row sideways.
                      */}
                      <span className="relative inline-grid">
                        <span aria-hidden className="invisible col-start-1 row-start-1 font-medium">
                          {item.labelFr}
                        </span>
                        <span className={cn('col-start-1 row-start-1', isActive ? 'font-medium' : 'font-normal')}>
                          {item.labelFr}
                        </span>
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2.5 border-t border-border px-4 py-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-text-muted">
          {initials || '—'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-text">{user.displayName}</span>
          <span className="block truncate text-xs text-text-dim">{user.email}</span>
        </span>
      </div>
    </nav>
  );
}
