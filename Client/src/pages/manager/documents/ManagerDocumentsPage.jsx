import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { documentsApi } from '../../../api/documents.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';

const AVAILABILITY_LABEL_KEYS = {
  AVAILABLE: 'manager.documents.availability.available',
  PENDING: 'manager.documents.availability.pending',
};

/**
 * /app/manager/documents — additional manager page (not in the PDF route guide; added on
 * request). Read-only view of the document library (GET /documents, already gated on
 * document:read, which MANAGER holds) — policies and procedures relevant to onboarding.
 * Publishing/versioning stays HR's job (/app/hr/documents); this page is read-only.
 */
export default function ManagerDocumentsPage() {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await documentsApi.list();
        setDocuments(data);
      } catch {
        setError(t('manager.documents.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) return <PageLoading label={t('manager.documents.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div>
      <PageHeader eyebrow={t('manager.eyebrow')} title={t('manager.documents.title')} subtitle={t('manager.documents.subtitle')} />

      <motion.div variants={staggerContainer(0.06)} initial={initialOrNone(reduce)} animate="visible" className="grid gap-3 sm:grid-cols-2">
        {documents.map((doc) => (
          <motion.div
            key={doc.id}
            variants={staggerItem}
            whileHover={reduce ? undefined : { y: -3, boxShadow: '0 10px 26px -10px rgba(127, 10, 29, 0.28)' }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-app border border-border bg-surface p-4 shadow-app"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-text">{doc.titleFr}</p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  doc.availability === 'AVAILABLE'
                    ? 'bg-status-green/10 text-status-green'
                    : 'bg-status-amber/10 text-status-amber'
                }`}
              >
                {AVAILABILITY_LABEL_KEYS[doc.availability]
                  ? t(AVAILABILITY_LABEL_KEYS[doc.availability])
                  : doc.availability}
              </span>
            </div>
            {doc.detailFr && <p className="mt-1 text-sm text-text-dim">{doc.detailFr}</p>}
            {doc._count && (
              <p className="mt-2 text-xs text-text-dim">
                {t('manager.documents.acknowledgementCount', { count: doc._count.acknowledgements })}
              </p>
            )}
          </motion.div>
        ))}
        {documents.length === 0 && <EmptyState detail={t('manager.documents.empty')} />}
      </motion.div>
    </div>
  );
}
