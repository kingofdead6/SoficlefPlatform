/**
 * The external systems the platform can be wired to, and what state each is in.
 *
 * Domain code: a description, not a client (ADR-019). Nothing here opens a socket.
 *
 * Every connector is declared even when nothing is configured, because "not configured"
 * is the fact an administrator most needs to see. A console that lists only what happens
 * to be connected cannot answer "why did no welcome e-mail go out" — the missing SMTP row
 * is the answer.
 */

export const CONNECTOR_IDS = [
  'entra',
  'hrApi',
  'directory',
  'smtp',
  'storage',
  'ai',
] as const;

export type ConnectorId = (typeof CONNECTOR_IDS)[number];

/**
 * What a connector is doing right now.
 *
 * `mock` and `unconfigured` are deliberately different. A mock connector answers with
 * seeded data on purpose — a demonstration, a test run. An unconfigured one answers with
 * nothing because nobody set it up, which is a gap rather than a choice. Collapsing them
 * into "not live" would hide which of the two you are looking at.
 */
export type ConnectorMode = 'production' | 'mock' | 'unconfigured';

export interface ConnectorDefinition {
  id: ConnectorId;
  labelFr: string;
  /** What breaks while this connector is not live. */
  consequenceFr: string;
  /** The environment variable that switches it on, for the administrator to go and set. */
  envVar: string;
  /**
   * Whether the platform can run a real check against it.
   *
   * False where a "test connection" would be theatre: there is no endpoint to call, so a
   * green tick would mean only that the button works.
   */
  testable: boolean;
}

export const CONNECTORS: Record<ConnectorId, ConnectorDefinition> = {
  entra: {
    id: 'entra',
    labelFr: 'Microsoft Entra ID',
    consequenceFr:
      'Les comptes sont créés à la main et les mots de passe gérés par la plateforme, sans authentification unique.',
    envVar: 'ENTRA_TENANT_ID',
    testable: false,
  },
  hrApi: {
    id: 'hrApi',
    labelFr: 'API SIRH',
    consequenceFr:
      'Les fiches collaborateurs sont saisies dans la plateforme au lieu d’être reprises du SIRH.',
    envVar: 'HR_API_URL',
    testable: false,
  },
  directory: {
    id: 'directory',
    labelFr: 'Répertoires partagés',
    consequenceFr: 'Les documents de référence ne sont pas synchronisés depuis un partage réseau.',
    envVar: 'DIRECTORY_SHARE_PATH',
    testable: false,
  },
  smtp: {
    id: 'smtp',
    labelFr: 'Serveur de messagerie (SMTP)',
    consequenceFr:
      'Aucune relance, aucun e-mail de bienvenue : les alertes ne sont visibles que dans la plateforme.',
    envVar: 'SMTP_HOST',
    testable: false,
  },
  storage: {
    id: 'storage',
    labelFr: 'Stockage de fichiers',
    consequenceFr:
      'Aucun téléversement : les pièces administratives et les documents sont suivis sans être stockés ici.',
    envVar: 'FILE_STORAGE_DRIVER',
    testable: false,
  },
  ai: {
    id: 'ai',
    labelFr: 'Fournisseur de modèle de langage',
    consequenceFr:
      'Les assistants répondent par recherche dans les données, sans génération de texte.',
    envVar: 'AI_PROVIDER_ENDPOINT',
    testable: false,
  },
};

export interface ConnectorStatus {
  definition: ConnectorDefinition;
  mode: ConnectorMode;
}

/**
 * Reads the mode of every connector from a plain environment map.
 *
 * Takes the environment as an argument rather than reading `process.env` itself, so the
 * rule is testable without mutating global state — the same reason `can()` takes a user.
 */
export function connectorStatuses(env: Record<string, string | undefined>): ConnectorStatus[] {
  return CONNECTOR_IDS.map((id) => {
    const definition = CONNECTORS[id];
    const value = env[definition.envVar]?.trim();

    return {
      definition,
      mode: !value ? 'unconfigured' : value.toLowerCase() === 'mock' ? 'mock' : 'production',
    };
  });
}
