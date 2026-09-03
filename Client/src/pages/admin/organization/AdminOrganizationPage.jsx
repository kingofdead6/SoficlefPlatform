import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { organizationUnitsApi, positionsApi } from '../../../api/organization.js';
import OrgChart from '../../../components/org/OrgChart.jsx';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { useGsapContext } from '../../../lib/motion/useGsapContext.js';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const FIELD =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

/**
 * The unit types §2.4 names: divisions, departments, sites. Kept as a closed list so the
 * tree stays classifiable — a free-text type would make "how many divisions" a question
 * about spelling. Labels live under admin.organization.unitTypes.* in the catalogues.
 */
const UNIT_TYPES = ['DIVISION', 'DEPARTMENT', 'SERVICE', 'SITE'];

const EMPTY_UNIT = { code: '', nameFr: '', type: 'DEPARTMENT', parentId: '', descriptionFr: '' };
const EMPTY_POSITION = { code: '', titleFr: '', organizationUnitId: '', parentPositionId: '' };

/**
 * Builds the unit tree for the left-hand outline. Units whose declared parent is not in the
 * visible set become roots rather than disappearing — the same rule OrgChart applies to
 * positions, so a filtered or dangling parent never silently drops a branch.
 */
function buildUnitTree(units) {
  const byId = new Map(units.map((unit) => [unit.id, { ...unit, children: [] }]));
  const roots = [];
  for (const unit of byId.values()) {
    const parent = unit.parentId ? byId.get(unit.parentId) : null;
    if (parent) parent.children.push(unit);
    else roots.push(unit);
  }
  const sort = (nodes) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    nodes.forEach((node) => sort(node.children));
  };
  sort(roots);
  return roots;
}

/**
 * /admin/organization (route guide §2.4, CORE).
 * "Structural editing of the tree: divisions, departments, sites, create/move/merge
 * position nodes, set parent_position_id — defines the skeleton HR fills."
 *
 * Two structures are edited here and they are not the same thing, which is why the page
 * shows them side by side rather than pretending to one tree:
 *
 *   - The **unit** tree (directions, départements, services, sites) is the organisational
 *     skeleton. It can be extended, archived and merged. Archiving refuses while a unit
 *     still holds anything; merging moves every child, post and permission scope into the
 *     target in one transaction, then archives the source.
 *   - The **position** tree is the reporting line. Each post carries a `parentPositionId`,
 *     which is what the shared OrgChart draws, and reparenting is its own action because it
 *     is the one edit that can corrupt the chart — the server refuses a move that would put
 *     a post under one of its own subordinates.
 *
 * Every control on this page hits a real endpoint. What the page does *not* do is fill the
 * skeleton: assigning a person to a post is HR's, and duplicating it here would give one
 * action two implementations.
 */
export default function AdminOrganizationPage() {
  const { t } = useTranslation();
  const [units, setUnits] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [panel, setPanel] = useState(null); // 'unit' | 'position' | null
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [selectedPositionId, setSelectedPositionId] = useState(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [reparentId, setReparentId] = useState('');
  const [busy, setBusy] = useState(false);
  const reduce = useReducedMotion();
  const scopeRef = useRef(null);

  const [unitForm, setUnitForm] = useState(EMPTY_UNIT);
  const [unitError, setUnitError] = useState(null);
  const [positionForm, setPositionForm] = useState(EMPTY_POSITION);
  const [positionError, setPositionError] = useState(null);

  const load = useCallback(async () => {
    try {
      // `tree()` rather than `list()`: both return a flat array, but the tree query joins
      // the current assignment, so each node carries its holder — which is what makes a
      // vacant post visibly vacant on the chart rather than merely unlabelled.
      const [unitsRes, positionsRes] = await Promise.all([
        organizationUnitsApi.list(),
        positionsApi.tree(),
      ]);
      setUnits(unitsRes.data ?? []);
      setPositions(positionsRes.data ?? []);
      setError(null);
    } catch {
      setError(t('admin.organization.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useGsapContext(
    scopeRef,
    ({ gsap }, reduced) => {
      if (reduced) {
        gsap.set('[data-gsap="reveal"]', { opacity: 1, y: 0 });
        return;
      }
      gsap.set('[data-gsap="reveal"]', { opacity: 0, y: 20 });
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .to('[data-gsap="reveal"]', { opacity: 1, y: 0, duration: 0.55, stagger: 0.1 });
    },
    [loading, units.length, positions.length],
  );

  const unitTree = useMemo(() => buildUnitTree(units), [units]);
  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const selectedUnit = selectedUnitId ? unitById.get(selectedUnitId) ?? null : null;
  const selectedPosition = positions.find((position) => position.id === selectedPositionId) ?? null;

  const stats = useMemo(
    () => ({
      units: units.length,
      positions: positions.length,
      roots: unitTree.length,
      orphanPositions: positions.filter((position) => !position.organizationUnitId).length,
    }),
    [units, positions, unitTree],
  );

  /** Positions of the selected unit, so the detail panel is about one place at a time. */
  const unitPositions = useMemo(
    () => (selectedUnit ? positions.filter((position) => position.organizationUnitId === selectedUnit.id) : []),
    [positions, selectedUnit],
  );

  function announce(tone, text) {
    setNotice({ tone, text });
  }

  async function run(action, successText) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      await load();
      announce('ok', successText);
      return true;
    } catch (err) {
      announce('warn', err.body?.message ?? t('admin.organization.opFailed'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateUnit(event) {
    event.preventDefault();
    setUnitError(null);
    setBusy(true);
    try {
      await organizationUnitsApi.create({
        code: unitForm.code.trim().toUpperCase(),
        nameFr: unitForm.nameFr,
        type: unitForm.type,
        parentId: unitForm.parentId || null,
        descriptionFr: unitForm.descriptionFr || null,
      });
      setUnitForm(EMPTY_UNIT);
      setPanel(null);
      await load();
      announce('ok', t('admin.organization.unitCreated'));
    } catch (err) {
      setUnitError(err.body?.message ?? t('admin.organization.unitCreateFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePosition(event) {
    event.preventDefault();
    setPositionError(null);
    setBusy(true);
    try {
      await positionsApi.create({
        code: positionForm.code.trim().toUpperCase(),
        titleFr: positionForm.titleFr,
        organizationUnitId: positionForm.organizationUnitId || null,
        parentPositionId: positionForm.parentPositionId || null,
      });
      setPositionForm(EMPTY_POSITION);
      setPanel(null);
      await load();
      announce('ok', t('admin.organization.positionCreated'));
    } catch (err) {
      setPositionError(err.body?.message ?? t('admin.organization.positionCreateFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveUnit(unit) {
    if (!window.confirm(t('admin.organization.confirmArchiveUnit', { name: unit.nameFr }))) {
      return;
    }
    const done = await run(() => organizationUnitsApi.archive(unit.id), t('admin.organization.unitArchived'));
    if (done) setSelectedUnitId(null);
  }

  async function handleMerge(event) {
    event.preventDefault();
    if (!selectedUnit || !mergeTargetId) return;
    const target = unitById.get(mergeTargetId);
    if (
      !window.confirm(
        t('admin.organization.confirmMerge', { source: selectedUnit.nameFr, target: target?.nameFr }),
      )
    ) {
      return;
    }
    const done = await run(async () => {
      const result = await organizationUnitsApi.merge(selectedUnit.id, mergeTargetId);
      announce(
        'ok',
        t('admin.organization.mergeDone', {
          units: result.movedChildren,
          positions: result.movedPositions,
          scopes: result.movedScopes,
        }),
      );
    }, t('admin.organization.mergeSuccess'));
    if (done) {
      setMergeTargetId('');
      setSelectedUnitId(null);
    }
  }

  async function handleReparent(event) {
    event.preventDefault();
    if (!selectedPosition) return;
    await run(
      () => positionsApi.reparent(selectedPosition.id, reparentId || null),
      reparentId ? t('admin.organization.positionAttached') : t('admin.organization.positionDetached'),
    );
  }

  async function handleArchivePosition(position) {
    if (!window.confirm(t('admin.organization.confirmArchivePosition', { title: position.titleFr }))) return;
    const done = await run(() => positionsApi.archive(position.id), t('admin.organization.positionArchived'));
    if (done) setSelectedPositionId(null);
  }

  if (loading) return <PageLoading label={t('admin.organization.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div ref={scopeRef} className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={t('admin.organization.eyebrow')}
        title={t('admin.organization.title')}
        subtitle={t('admin.organization.subtitle')}
        actions={
          <>
            <button
              type="button"
              onClick={() => setPanel((current) => (current === 'position' ? null : 'position'))}
              className={SECONDARY_BUTTON}
            >
              {t('admin.organization.newPosition')}
            </button>
            <button
              type="button"
              onClick={() => setPanel((current) => (current === 'unit' ? null : 'unit'))}
              className={PRIMARY_BUTTON}
            >
              {t('admin.organization.newUnit')}
            </button>
          </>
        }
      />

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Tile label={t('admin.organization.tiles.units')} value={stats.units} />
        <Tile label={t('admin.organization.tiles.positions')} value={stats.positions} />
        <Tile label={t('admin.organization.tiles.roots')} value={stats.roots} />
        <Tile
          label={t('admin.organization.tiles.orphanPositions')}
          value={stats.orphanPositions}
          tone={stats.orphanPositions > 0 ? 'red' : undefined}
        />
      </motion.div>

      <AnimatePresence initial={false}>
        {notice && (
          <motion.p
            key={notice.text}
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`mb-4 overflow-hidden rounded-app border p-3 text-sm ${
              notice.tone === 'warn'
                ? 'border-status-red/30 bg-status-red/5 text-status-red'
                : 'border-status-green/30 bg-status-green/5 text-status-green'
            }`}
          >
            {notice.text}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Creation panels */}
      <AnimatePresence initial={false}>
        {panel === 'unit' && (
          <Collapse reduce={reduce}>
            <form onSubmit={handleCreateUnit} className={`${CARD} mb-6 space-y-4 p-6`}>
              <h2 className="font-display text-lg text-text">{t('admin.organization.unitForm.title')}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Labelled label={t('admin.organization.unitForm.code')}>
                  <input
                    required
                    minLength={2}
                    placeholder="DIR_TECH"
                    value={unitForm.code}
                    onChange={(e) => setUnitForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className={`${FIELD} font-mono`}
                  />
                </Labelled>
                <Labelled label={t('admin.organization.unitForm.name')}>
                  <input
                    required
                    minLength={2}
                    value={unitForm.nameFr}
                    onChange={(e) => setUnitForm((f) => ({ ...f, nameFr: e.target.value }))}
                    className={FIELD}
                  />
                </Labelled>
                <Labelled label={t('admin.organization.unitForm.type')}>
                  <select
                    value={unitForm.type}
                    onChange={(e) => setUnitForm((f) => ({ ...f, type: e.target.value }))}
                    className={FIELD}
                  >
                    {UNIT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {t(`admin.organization.unitTypes.${type}`)}
                      </option>
                    ))}
                  </select>
                </Labelled>
                <Labelled label={t('admin.organization.unitForm.parent')}>
                  <select
                    value={unitForm.parentId}
                    onChange={(e) => setUnitForm((f) => ({ ...f, parentId: e.target.value }))}
                    className={FIELD}
                  >
                    <option value="">{t('admin.organization.unitForm.parentRoot')}</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.code} — {unit.nameFr}
                      </option>
                    ))}
                  </select>
                </Labelled>
              </div>
              <Labelled label={t('admin.organization.unitForm.description')} hint={t('admin.organization.unitForm.descriptionHint')}>
                <textarea
                  rows={2}
                  value={unitForm.descriptionFr}
                  onChange={(e) => setUnitForm((f) => ({ ...f, descriptionFr: e.target.value }))}
                  className={FIELD}
                />
              </Labelled>
              {unitError && <p className="text-sm text-status-red">{unitError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPanel(null)} className={SECONDARY_BUTTON}>
                  {t('common.actions.cancel')}
                </button>
                <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
                  {busy ? t('admin.organization.unitForm.creating') : t('admin.organization.unitForm.create')}
                </button>
              </div>
            </form>
          </Collapse>
        )}

        {panel === 'position' && (
          <Collapse reduce={reduce}>
            <form onSubmit={handleCreatePosition} className={`${CARD} mb-6 space-y-4 p-6`}>
              <h2 className="font-display text-lg text-text">{t('admin.organization.positionForm.title')}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Labelled label={t('admin.organization.positionForm.code')}>
                  <input
                    required
                    minLength={2}
                    placeholder="RESP_QUAL"
                    value={positionForm.code}
                    onChange={(e) => setPositionForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className={`${FIELD} font-mono`}
                  />
                </Labelled>
                <Labelled label={t('admin.organization.positionForm.titleLabel')}>
                  <input
                    required
                    minLength={2}
                    value={positionForm.titleFr}
                    onChange={(e) => setPositionForm((f) => ({ ...f, titleFr: e.target.value }))}
                    className={FIELD}
                  />
                </Labelled>
                <Labelled label={t('admin.organization.positionForm.unit')}>
                  <select
                    value={positionForm.organizationUnitId}
                    onChange={(e) => setPositionForm((f) => ({ ...f, organizationUnitId: e.target.value }))}
                    className={FIELD}
                  >
                    <option value="">{t('admin.organization.positionForm.unitNone')}</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.code} — {unit.nameFr}
                      </option>
                    ))}
                  </select>
                </Labelled>
                <Labelled label={t('admin.organization.positionForm.parentPosition')}>
                  <select
                    value={positionForm.parentPositionId}
                    onChange={(e) => setPositionForm((f) => ({ ...f, parentPositionId: e.target.value }))}
                    className={FIELD}
                  >
                    <option value="">{t('admin.organization.positionForm.parentPositionRoot')}</option>
                    {positions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.titleFr}
                      </option>
                    ))}
                  </select>
                </Labelled>
              </div>
              {positionError && <p className="text-sm text-status-red">{positionError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPanel(null)} className={SECONDARY_BUTTON}>
                  {t('common.actions.cancel')}
                </button>
                <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
                  {busy ? t('admin.organization.positionForm.creating') : t('admin.organization.positionForm.create')}
                </button>
              </div>
            </form>
          </Collapse>
        )}
      </AnimatePresence>

      {/* Unit outline + detail */}
      <div data-gsap="reveal" className="mb-10 grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-1">
          <h2 className="mb-3 font-display text-xl text-text">{t('admin.organization.unitTree.title')}</h2>
          {unitTree.length === 0 ? (
            <EmptyState muted title={t('admin.organization.unitTree.empty')} detail={t('admin.organization.unitTree.emptyDetail')} />
          ) : (
            <div className={`${CARD} max-h-[26rem] overflow-y-auto p-3`}>
              <UnitBranch
                nodes={unitTree}
                depth={0}
                selectedId={selectedUnitId}
                onSelect={(id) => {
                  setSelectedUnitId((current) => (current === id ? null : id));
                  setMergeTargetId('');
                }}
              />
            </div>
          )}
        </section>

        <section className="lg:col-span-2">
          <h2 className="mb-3 font-display text-xl text-text">
            {selectedUnit ? selectedUnit.nameFr : t('admin.organization.unitDetail.title')}
          </h2>

          {!selectedUnit ? (
            <EmptyState
              muted
              title={t('admin.organization.unitDetail.empty')}
              detail={t('admin.organization.unitDetail.emptyDetail')}
            />
          ) : (
            <div className={`${CARD} space-y-5 p-5`}>
              <dl className="grid gap-2 text-sm sm:grid-cols-3">
                <Detail label={t('admin.organization.unitDetail.code')} value={selectedUnit.code} mono />
                <Detail label={t('admin.organization.unitDetail.type')} value={t(`admin.organization.unitTypes.${selectedUnit.type}`, selectedUnit.type)} />
                <Detail
                  label={t('admin.organization.unitDetail.parent')}
                  value={
                    selectedUnit.parentId
                      ? unitById.get(selectedUnit.parentId)?.nameFr ?? t('admin.organization.unitDetail.parentOutOfScope')
                      : t('admin.organization.unitDetail.parentRoot')
                  }
                />
              </dl>

              <div>
                <p className="mb-2 text-sm font-medium text-text">
                  {t('admin.organization.unitDetail.attachedPositions', { count: unitPositions.length })}
                </p>
                {unitPositions.length === 0 ? (
                  <p className="text-sm text-text-dim">{t('admin.organization.unitDetail.noPositions')}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {unitPositions.map((position) => (
                      <button
                        key={position.id}
                        type="button"
                        onClick={() => {
                          setSelectedPositionId(position.id);
                          setReparentId(position.parentPositionId ?? '');
                        }}
                        className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-muted transition-colors hover:text-red-brand"
                      >
                        {position.titleFr}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Merge */}
              <form onSubmit={handleMerge} className="border-t border-border pt-4">
                <p className="mb-1 text-sm font-medium text-text">{t('admin.organization.unitDetail.mergeTitle')}</p>
                <p className="mb-3 text-xs text-text-dim">
                  {t('admin.organization.unitDetail.mergeDetail', { name: selectedUnit.nameFr })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <select
                    required
                    value={mergeTargetId}
                    onChange={(e) => setMergeTargetId(e.target.value)}
                    className={`${FIELD} max-w-sm flex-1`}
                  >
                    <option value="">{t('admin.organization.unitDetail.mergeTargetPlaceholder')}</option>
                    {units
                      .filter((unit) => unit.id !== selectedUnit.id)
                      .map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.code} — {unit.nameFr}
                        </option>
                      ))}
                  </select>
                  <button type="submit" disabled={busy || !mergeTargetId} className={PRIMARY_BUTTON}>
                    {t('admin.organization.unitDetail.merge')}
                  </button>
                </div>
              </form>

              <div className="flex justify-end border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => handleArchiveUnit(selectedUnit)}
                  disabled={busy}
                  className="text-xs text-status-red hover:underline disabled:opacity-60"
                >
                  {t('admin.organization.unitDetail.archiveUnit')}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Position chart + reparenting */}
      <div data-gsap="reveal" className="grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-xl text-text">{t('admin.organization.positionChart.title')}</h2>
            <span className="text-sm text-text-dim">{t('admin.organization.positionChart.count', { count: positions.length })}</span>
          </div>
          <p className="mb-3 text-sm text-text-dim">{t('admin.organization.positionChart.hint')}</p>
          <div className={`overflow-x-auto ${CARD} p-4`}>
            <OrgChart
              nodes={positions}
              toneOf={(node) =>
                node.id === selectedPositionId
                  ? 'root'
                  : node.holder
                    ? undefined
                    : 'vacant'
              }
              subtitleOf={(node) =>
                node.organizationUnitId
                  ? unitById.get(node.organizationUnitId)?.code ?? null
                  : t('admin.organization.positionChart.noUnit')
              }
              onSelect={(node) => {
                setSelectedPositionId(node.id);
                setReparentId(node.parentPositionId ?? '');
              }}
              emptyLabel={t('admin.organization.positionChart.empty')}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-text">
            {selectedPosition ? selectedPosition.titleFr : t('admin.organization.positionDetail.title')}
          </h2>

          {!selectedPosition ? (
            <EmptyState
              muted
              title={t('admin.organization.positionDetail.empty')}
              detail={t('admin.organization.positionDetail.emptyDetail')}
            />
          ) : (
            <div className={`${CARD} space-y-4 p-5`}>
              <dl className="grid gap-2 text-sm">
                <Detail label={t('admin.organization.positionDetail.code')} value={selectedPosition.code} mono />
                <Detail
                  label={t('admin.organization.positionDetail.unit')}
                  value={
                    selectedPosition.organizationUnitId
                      ? unitById.get(selectedPosition.organizationUnitId)?.nameFr ?? '—'
                      : t('admin.organization.positionDetail.unitNone')
                  }
                />
                <Detail
                  label={t('admin.organization.positionDetail.holder')}
                  value={selectedPosition.holder?.displayName ?? t('admin.organization.positionDetail.vacant')}
                />
              </dl>

              <form onSubmit={handleReparent} className="space-y-2 border-t border-border pt-4">
                <Labelled
                  label={t('admin.organization.positionDetail.reparentLabel')}
                  hint={t('admin.organization.positionDetail.reparentHint')}
                >
                  <select
                    value={reparentId}
                    onChange={(e) => setReparentId(e.target.value)}
                    className={FIELD}
                  >
                    <option value="">{t('admin.organization.positionDetail.reparentNone')}</option>
                    {positions
                      .filter((position) => position.id !== selectedPosition.id)
                      .map((position) => (
                        <option key={position.id} value={position.id}>
                          {position.titleFr}
                        </option>
                      ))}
                  </select>
                </Labelled>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleArchivePosition(selectedPosition)}
                    disabled={busy}
                    className="rounded-app border border-border px-3 py-2 text-xs font-medium text-status-red transition-colors hover:bg-surface-2 disabled:opacity-60"
                  >
                    {t('admin.organization.positionDetail.archive')}
                  </button>
                  <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
                    {busy ? t('admin.organization.positionDetail.moving') : t('admin.organization.positionDetail.move')}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      </div>

      <p className="mt-8 rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-xs text-text-dim">
        {t('admin.organization.footnote')}
      </p>
    </div>
  );
}

const PRIMARY_BUTTON =
  'rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60';
const SECONDARY_BUTTON =
  'rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand';

function UnitBranch({ nodes, depth, selectedId, onSelect }) {
  return (
    <ul className={depth === 0 ? 'space-y-0.5' : 'space-y-0.5 border-l border-border pl-3'}>
      {nodes.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            className={`flex w-full items-center justify-between gap-2 rounded-app px-2 py-1.5 text-left text-sm transition-colors ${
              selectedId === node.id
                ? 'bg-red-brand/10 text-red-deep'
                : 'text-text hover:bg-surface-2'
            }`}
          >
            <span className="truncate">{node.nameFr}</span>
            <span className="shrink-0 font-mono text-[10px] text-text-dim">{node.code}</span>
          </button>
          {node.children.length > 0 && (
            <UnitBranch nodes={node.children} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
          )}
        </li>
      ))}
    </ul>
  );
}

function Collapse({ children, reduce }) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      {children}
    </motion.div>
  );
}

function Labelled({ label, hint, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-text-dim">{hint}</p>}
    </div>
  );
}

function Detail({ label, value, mono }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 text-text-dim">{label} :</dt>
      <dd className={`truncate text-text ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}

function Tile({ label, value, tone }) {
  return (
    <motion.div variants={staggerItem} className={`${CARD} p-5`}>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      <p className={`font-display text-3xl ${tone === 'red' ? 'text-status-red' : 'text-red-deep'}`}>
        <CountUp value={value} />
      </p>
    </motion.div>
  );
}
