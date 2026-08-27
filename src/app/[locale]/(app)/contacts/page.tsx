import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { type Column, DataTable, EmptyState, StatusBadge } from '@/components/ui';
import { prisma } from '@/infrastructure/db/client';
import { canOpen } from '@/application/navigation/build-navigation';
import { navItemByHref } from '@/domain/navigation/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

type ContactRow = Awaited<ReturnType<typeof loadContacts>>[number];

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The page is the boundary, not the sidebar (ADR-020). The layout checks too, but a
  // page that trusts its layout has no defence if that layout is ever bypassed.
  const item = navItemByHref('/contacts');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  let contacts: ContactRow[] = [];

  try {
    contacts = await loadContacts();
  } catch (error) {
    console.error('Failed to load contacts data:', error);
  }

  if (contacts.length === 0) {
    return (
      <EmptyState
        title="Interlocuteurs"
        description="L'annuaire des interlocuteurs n'est pas encore disponible."
      />
    );
  }

  const columns: Column<ContactRow>[] = [
    { key: 'extension', header: 'Poste', mono: true, render: (row) => row.extension },
    { key: 'initials', header: 'Sigle', mono: true, render: (row) => row.initials },
    { key: 'name', header: 'Nom', render: (row) => row.nameFr },
    { key: 'role', header: 'Fonction', render: (row) => row.roleFr },
    {
      key: 'priority',
      header: 'Priorité',
      align: 'end',
      render: (row) => (
        <StatusBadge label={row.priorityFr} tone={row.priorityRank === 'S1' ? 'brand' : 'neutral'} />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={contacts}
      getRowKey={(row) => row.id}
      caption="Annuaire des interlocuteurs"
      emptyLabel="Aucun interlocuteur"
    />
  );
}

async function loadContacts() {
  return prisma.contact.findMany({ orderBy: [{ priorityRank: 'asc' }, { order: 'asc' }] });
}
