/**
 * @file    src/config/project.ts
 * @description
 *   Centralized project configuration and URL registry.
 *   Avoids hardcoding repository, author, documentation, and external links across the codebase.
 *   Supports dynamic overrides via Vite environment variables (VITE_*).
 */

// Safe retrieval of environment variables across Vite browser bundle and Node.js test runners
const getEnvVar = (key: string, fallback: string): string => {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string> };
    if (meta && meta.env && meta.env[key]) {
      return String(meta.env[key]);
    }
  } catch {
    // Ignore in environments where import.meta is restricted
  }
  try {
    const g = globalThis as unknown as { process?: { env?: Record<string, string> } };
    if (g.process && g.process.env && g.process.env[key]) {
      return String(g.process.env[key]);
    }
  } catch {
    // Ignore in environments where process is not defined
  }
  return fallback;
};

export const PROJECT_OWNER = getEnvVar('VITE_GITHUB_OWNER', 'GuoBug');
export const PROJECT_REPO = getEnvVar('VITE_GITHUB_REPO', 'PatchCat');
export const PROJECT_AUTHOR = getEnvVar('VITE_AUTHOR_NAME', 'GuoQiang');

/**
 * GitHub repository path ($GITHUB_PATH) and main base URLs
 */
export const GITHUB_PATH = `${PROJECT_OWNER}/${PROJECT_REPO}`;
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_PATH}`;
export const GITHUB_OWNER_URL = `https://github.com/${PROJECT_OWNER}`;

/**
 * Project Home ($HOME) - Official GitHub Pages live deployment URL
 */
export const PROJECT_HOME_URL = getEnvVar(
  'VITE_PROJECT_HOME_URL',
  `https://${PROJECT_OWNER}.github.io/${PROJECT_REPO}/`,
);

/**
 * Specific feature links
 */
export const GITHUB_ISSUES_URL = `${GITHUB_REPO_URL}/issues`;
export const GITHUB_DISCUSSIONS_URL = `${GITHUB_REPO_URL}/discussions`;
export const GITHUB_RELEASES_URL = `${GITHUB_REPO_URL}/releases`;
export const GITHUB_ACTIONS_URL = `${GITHUB_REPO_URL}/actions`;
export const GITHUB_README_URL = `${GITHUB_REPO_URL}/blob/main/README.md`;
export const GITHUB_CODESPACES_URL = `https://codespaces.new/${GITHUB_PATH}`;
export const GITHUB_RAW_BASE_URL = `https://raw.githubusercontent.com/${GITHUB_PATH}/main`;

/**
 * Aggregated links registry for convenient imports
 */
export const PROJECT_LINKS = {
  home: PROJECT_HOME_URL,
  repo: GITHUB_REPO_URL,
  owner: GITHUB_OWNER_URL,
  authorName: PROJECT_AUTHOR,
  authorHandle: `@${PROJECT_OWNER}`,
  issues: GITHUB_ISSUES_URL,
  discussions: GITHUB_DISCUSSIONS_URL,
  releases: GITHUB_RELEASES_URL,
  actions: GITHUB_ACTIONS_URL,
  readme: GITHUB_README_URL,
  codespaces: GITHUB_CODESPACES_URL,
  rawContent: GITHUB_RAW_BASE_URL,
  guide: GITHUB_REPO_URL,
} as const;

export default PROJECT_LINKS;
