/**
 * A glyph per navigation entry.
 *
 * The sidebar carries up to thirty-nine entries across four role trees, and several share
 * a label by design — an employee, a manager and HR each have a "dashboard" and an "org
 * chart". Read as text alone the list is a wall in which nothing is findable; a glyph
 * gives each row a shape the eye can aim at, and disambiguates the repeats.
 *
 * Inline SVG rather than an icon package: nineteen small paths weigh less than a
 * dependency, and they inherit `currentColor` so the active tint applies without a second
 * colour rule.
 *
 * Always `aria-hidden`. The label beside it is the accessible name; announcing "briefcase,
 * My position" would add noise, not information.
 */

const PATHS: Record<string, string> = {
  // ── Mon espace ─────────────────────────────────────────────────────────────
  meDashboard: 'M3 12h4l3 8 4-16 3 8h4',
  meJourney: 'M4 6h16M4 12h16M4 18h10',
  meOrganigram: 'M12 4v5m0 0H7v4m5-4h5v4M5 17h4m6 0h4M3 13h4v4H3zm12 0h4v4h-4zM10 4h4v5h-4z',
  mePosition: 'M4 8h16v11H4zM9 8V6a3 3 0 016 0v2',
  meTeam: 'M16 19v-2a4 4 0 00-8 0v2M12 11a3 3 0 100-6 3 3 0 000 6M20 19v-1a3 3 0 00-2-2.8',
  meDocuments: 'M6 3h8l4 4v14H6zM14 3v4h4',
  meFiles: 'M4 7h6l2 2h8v10H4z',
  meTraining: 'M3 8l9-4 9 4-9 4zM7 11v4c0 1 2 2 5 2s5-1 5-2v-4',
  meSurveys: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  meAssistant: 'M4 5h16v10H9l-5 4z',

  // ── Encadrement ────────────────────────────────────────────────────────────
  managerDashboard: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 8h6V4h-6z',
  managerRecruits: 'M15 19v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M8.5 9a3.5 3.5 0 100-7 3.5 3.5 0 000 7M18 8v6M21 11h-6',
  managerEvaluations: 'M9 11l2 2 4-5M5 4h14v16H5z',
  managerOrganigram: 'M12 4v5m0 0H7v4m5-4h5v4M5 17h4m6 0h4M3 13h4v4H3zm12 0h4v4h-4zM10 4h4v5h-4z',
  managerTeam: 'M16 19v-2a4 4 0 00-8 0v2M12 11a3 3 0 100-6 3 3 0 000 6M20 19v-1a3 3 0 00-2-2.8',
  managerReports: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  managerAssistant: 'M4 5h16v10H9l-5 4z',

  // ── Ressources humaines ────────────────────────────────────────────────────
  hrDashboard: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 8h6V4h-6z',
  hrUnassigned: 'M12 8v5M12 16h.01M12 3l9 16H3z',
  hrEmployees: 'M17 19v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 9a3 3 0 100-6 3 3 0 000 6M21 19v-2a3 3 0 00-2-2.9',
  hrOrganigram: 'M12 4v5m0 0H7v4m5-4h5v4M5 17h4m6 0h4M3 13h4v4H3zm12 0h4v4h-4zM10 4h4v5h-4z',
  hrPositions: 'M4 8h16v11H4zM9 8V6a3 3 0 016 0v2M4 13h16',
  hrTemplates: 'M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z',
  hrDocuments: 'M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h4',
  hrTraining: 'M3 8l9-4 9 4-9 4zM7 11v4c0 1 2 2 5 2s5-1 5-2v-4',
  hrSurveys: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  hrAnalytics: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  hrAlerts: 'M18 8a6 6 0 10-12 0c0 6-2 7-2 7h16s-2-1-2-7M10 19a2 2 0 004 0',
  hrAiKnowledge: 'M12 3a4 4 0 014 4v1a4 4 0 010 8v1a4 4 0 01-8 0v-1a4 4 0 010-8V7a4 4 0 014-4M12 3v18',

  // ── Administration ─────────────────────────────────────────────────────────
  adminConsole: 'M4 5h16v11H4zM9 20h6M12 16v4',
  adminUsers: 'M17 19v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 9a3 3 0 100-6 3 3 0 000 6M21 19v-2a3 3 0 00-2-2.9',
  adminRoles: 'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7zM9 12l2 2 4-4',
  adminOrganization: 'M12 4v5m0 0H7v4m5-4h5v4M5 17h4m6 0h4M3 13h4v4H3zm12 0h4v4h-4zM10 4h4v5h-4z',
  adminIntegrations: 'M9 3v6M15 3v6M6 9h12v4a6 6 0 01-12 0zM12 19v2',
  adminAi: 'M12 3a4 4 0 014 4v1a4 4 0 010 8v1a4 4 0 01-8 0v-1a4 4 0 010-8V7a4 4 0 014-4M12 3v18',
  adminAudit: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  adminSecurity: 'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z',
  adminBackups: 'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  adminGdpr: 'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7zM12 9v4M12 16h.01',
  adminSettings: 'M12 15a3 3 0 100-6 3 3 0 000 6M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 007 19.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003 14a2 2 0 110-4h.1A1.6 1.6 0 004.6 7l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010 4.6V4a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1A1.6 1.6 0 0021 10a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1',

  // ── Pilotage, onboarding, référentiels ─────────────────────────────────────
  dashboard: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 8h6V4h-6z',
  welcome: 'M4 6h16v12H4zM4 7l8 6 8-6',
  company: 'M4 20V7l8-4 8 4v13M9 20v-5h6v5M8 11h.01M12 11h.01M16 11h.01',
  strategy: 'M12 3v18M3 12h18M12 3a9 9 0 010 18 9 9 0 010-18',
  jobDescription: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h4',
  organization: 'M12 4v5m0 0H7v4m5-4h5v4M5 17h4m6 0h4M3 13h4v4H3zm12 0h4v4h-4zM10 4h4v5h-4z',
  management: 'M16 19v-2a4 4 0 00-8 0v2M12 11a3 3 0 100-6 3 3 0 000 6M20 19v-1a3 3 0 00-2-2.8',
  recruitment: 'M15 19v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M8.5 9a3.5 3.5 0 100-7 3.5 3.5 0 000 7M18 8v6M21 11h-6',
  kaizen: 'M4 17l5-5 3 3 7-7M14 8h6v6',
  qms: 'M9 11l2 2 4-5M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z',
  hse: 'M12 8v5M12 16h.01M12 3l9 16H3z',
  contacts: 'M5 4h14v16H5zM9 10a2 2 0 104 0 2 2 0 10-4 0M8 16c.7-1.3 2-2 4-2s3.3.7 4 2',
  documents: 'M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h4',
  onboardingChecklist: 'M9 11l2 2 4-5M5 4h14v16H5z',
  competencies: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  training: 'M3 8l9-4 9 4-9 4zM7 11v4c0 1 2 2 5 2s5-1 5-2v-4',
  surveys: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  remarks: 'M4 5h16v10H9l-5 4z',
};

/** A neutral mark for an entry with no glyph of its own, so nothing is ever misaligned. */
const FALLBACK = 'M5 12h14';

export function NavIcon({ id, className }: { id: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={PATHS[id] ?? FALLBACK} />
    </svg>
  );
}
