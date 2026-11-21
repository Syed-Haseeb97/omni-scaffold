/**
 * src/providers/auth/none.js — "No auth" placeholder
 */
export const meta = {
  id: 'auth-none',
  label: 'None (handle auth yourself)',
  category: 'auth',
  freeTierNotes: 'N/A',
  docsUrl: '',
};

export const auth = { type: 'none', envVar: null, tokenInstructions: null, scopesNeeded: [] };
export const verify = async () => ({ ok: true, account: 'N/A', quotaInfo: 'No auth provider' });
export const provision = async () => ({ outputs: {}, resources: [], urls: {} });
export const destroy = async () => {};
