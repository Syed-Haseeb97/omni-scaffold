import { describe, it, expect } from 'vitest';
import { mask, registerSecret, storeCredential, getCredential, deleteCredential, hasCredential } from '../credentials.js';

describe('Credentials & Secret Masking', () => {
  it('masks registered secrets properly in log outputs', () => {
    const secret = 'super-secret-token-12345';
    registerSecret(secret);

    const logMessage = `Connecting to API using ${secret} now.`;
    const masked = mask(logMessage);

    expect(masked).not.toContain(secret);
    expect(masked).toContain('***REDACTED***');
  });

  it('stores, verifies presence, retrieves and deletes credentials', async () => {
    const testSecret = 'ghp_testTokenForUnitTests9876543210';
    await storeCredential('test-provider', 'token', testSecret);

    const exists = await hasCredential('test-provider', 'token');
    expect(exists).toBe(true);

    const retrieved = await getCredential('test-provider', 'token');
    expect(retrieved).toBe(testSecret);

    await deleteCredential('test-provider', 'token');
    const afterDelete = await getCredential('test-provider', 'token');
    expect(afterDelete).toBeNull();
  });
});
