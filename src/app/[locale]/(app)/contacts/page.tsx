import { setRequestLocale } from 'next-intl/server';

import { type Column, DataTable, EmptyState, StatusBadge } from '@/components/ui';
import { prisma } from '@/infrastructure/db/client';

type ContactRow = Awaited<ReturnType<typeof loadContacts>>[number];

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

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
        <StatusBadge label={row.priorityFr} tone={row.priorityRank === 'S1' ? 'gold' : 'neutral'} />
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
