/**
 * src/providers/_stub.js — Base for stub providers
 *
 * Import and re-export this to create a provider stub that shows
 * manual steps and documentation links instead of provisioning automatically.
 */

/**
 * Create a stub provider.
 * @param {object} opts
 * @param {string} opts.id
 * @param {string} opts.label
 * @param {string} opts.category
 * @param {string} opts.freeTierNotes
 * @param {string} opts.docsUrl
 * @param {string} opts.setupUrl
 * @param {string} [opts.envVar]
 * @param {string} [opts.tokenUrl]
 * @param {string[]} [opts.manualSteps]
 * @returns {object} Provider module shape
 */
export function makeStub({
  id, label, category, freeTierNotes, docsUrl, setupUrl,
  envVar = `${id.toUpperCase().replace(/-/g, '_')}_API_KEY`,
  tokenUrl,
  manualSteps = [],
}) {
  return {
    meta: { id, label, category, freeTierNotes, docsUrl },

    auth: {
      type: 'token',
      envVar,
      tokenUrl: tokenUrl || setupUrl,
      tokenInstructions: `Visit ${tokenUrl || setupUrl} to get your API key`,
      scopesNeeded: [],
    },

    async verify(creds) {
      const token = creds?.token || (envVar && creds?.[envVar]);
      if (!token) {
        return { ok: false, account: null, quotaInfo: 'No credential stored' };
      }
      return {
        ok: true,
        account: 'API key configured',
        plan: freeTierNotes || 'Free tier',
        quotaInfo: 'Credential stored successfully',
      };
    },

    async provision(ctx) {
      const chalk = (await import('chalk')).default;
      console.log(chalk.yellow(`\n⚠  ${label} — Manual setup required`));
      console.log(chalk.gray(`   Docs: ${docsUrl}`));
      console.log(chalk.gray(`   Setup: ${setupUrl}`));
      if (manualSteps.length > 0) {
        console.log(chalk.bold('\n   Steps:'));
        manualSteps.forEach((step, i) => {
          console.log(`   ${i + 1}. ${step}`);
        });
      }
      return { outputs: {}, resources: [], urls: { setup: setupUrl } };
    },

    async destroy(ctx, resources) {
      const chalk = (await import('chalk')).default;
      console.log(chalk.yellow(`\n⚠  ${label} — Manual destroy required`));
      console.log(chalk.gray(`   Visit ${setupUrl} to remove resources manually`));
    },
  };
}
