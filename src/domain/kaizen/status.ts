/**
 * The status values a tracked Kaizen action may take (CDC v1 §3.5).
 *
 * `KaizenAction.statusFr` is free text in the schema because that is how the
 * consultant's reports write it, and the extraction preserves them verbatim (ADR-027).
 * Constraining the *input* to the three values the client's own reports use keeps the
 * column faithful while stopping the UI from introducing a fourth spelling of "En cours".
 *
 * This lives outside the `'use server'` module on purpose: every export of an actions
 * module becomes a server-action reference in the client bundle, so a plain array
 * exported from there arrives on the client as a function and cannot be mapped over.
 *
 * Domain code: imports nothing (ADR-019).
 */
export const KAIZEN_STATUSES = ['Planifiée', 'En cours', 'Clôturée'] as const;

export type KaizenStatus = (typeof KAIZEN_STATUSES)[number];
