/**
 * The external systems the platform can be wired to, and what state each is in.
 *
 * Domain code: a description, not a client. Nothing here opens a socket.
 *
 * Every connector is declared even when nothing is configured, because "not configured"
 * is the fact an administrator most needs to see. A console that lists only what happens
 * to be connected cannot answer "why did no welcome e-mail go out" — the missing SMTP row
 * is the answer.
 *
 * Ported faithfully from SoficlefPlatform src/domain/admin/connectors.ts.
 */

export const CONNECTOR_IDS = ['entra', 'hrApi', 'directory', 'smtp', 'storage', 'ai'];

export const CONNECTORS = {
  entra: {
    id: 'entra',
    labelFr: 'Microsoft Entra ID',
    consequenceFr:
      "Les comptes sont créés à la main et les mots de passe gérés par la plateforme, sans authentification unique.",
    envVar: 'ENTRA_TENANT_ID',
    testable: false,
  },
  hrApi: {
    id: 'hrApi',
    labelFr: 'API SIRH',
    consequenceFr:
      "Les fiches collaborateurs sont saisies dans la plateforme au lieu d'être reprises du SIRH.",
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
      "Aucune relance, aucun e-mail de bienvenue : les alertes ne sont visibles que dans la plateforme.",
    envVar: 'SMTP_HOST',
    testable: false,
  },
  storage: {
    id: 'storage',
    labelFr: 'Stockage de fichiers',
    consequenceFr:
      "Aucun téléversement : les pièces administratives et les documents sont suivis sans être stockés ici.",
    envVar: 'FILE_STORAGE_DRIVER',
    testable: false,
  },
  ai: {
    id: 'ai',
    labelFr: 'Fournisseur de modèle de langage',
    consequenceFr:
      "Les assistants répondent par recherche dans les données, sans génération de texte.",
    envVar: 'AI_PROVIDER_ENDPOINT',
    testable: false,
  },
};

/**
 * Reads the mode of every connector from a plain environment map.
 *
 * Takes the environment as an argument rather than reading `process.env` itself, so the
 * rule is testable without mutating global state — the same reason `can()` takes a user.
 */
export function connectorStatuses(env) {
  return CONNECTOR_IDS.map((id) => {
    const definition = CONNECTORS[id];
    const value = env[definition.envVar]?.trim();

    return {
      definition,
      mode: !value ? 'unconfigured' : value.toLowerCase() === 'mock' ? 'mock' : 'production',
    };
  });
}
