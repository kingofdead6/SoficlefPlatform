import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { contactsApi } from '../../api/contacts.js';
import { ApiError } from '../../api/client.js';

export default function ContactsPage() {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    contactsApi
      .list()
      .then((res) => setContacts(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : t('common.states.loadFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <div className="text-text-dim">{t('common.states.loading')}</div>;
  if (error) return <div className="text-status-red">{error}</div>;
  if (contacts.length === 0) {
    return (
      <div className="rounded-app border border-border bg-surface p-6 text-text-dim shadow-app">
        {t('contacts.unavailable')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-red-deep">{t('contacts.title')}</h1>

      <div className="overflow-hidden rounded-app border border-border bg-surface shadow-app">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-surface-2 text-text-dim">
            <tr>
              <th className="px-4 py-2 font-medium">{t('contacts.columns.extension')}</th>
              <th className="px-4 py-2 font-medium">{t('contacts.columns.initials')}</th>
              <th className="px-4 py-2 font-medium">{t('common.labels.name')}</th>
              <th className="px-4 py-2 font-medium">{t('contacts.columns.role')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('contacts.columns.priority')}</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-text">{contact.extension}</td>
                <td className="px-4 py-2 font-mono text-text">{contact.initials}</td>
                <td className="px-4 py-2 text-text">{contact.nameFr}</td>
                <td className="px-4 py-2 text-text">{contact.roleFr}</td>
                <td className="px-4 py-2 text-right">
                  <span
                    className={`rounded-app px-2 py-1 text-[11px] ${
                      contact.priorityRank === 'S1' ? 'bg-red-brand/10 text-red-brand' : 'bg-surface-2 text-text-dim'
                    }`}
                  >
                    {contact.priorityFr}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
