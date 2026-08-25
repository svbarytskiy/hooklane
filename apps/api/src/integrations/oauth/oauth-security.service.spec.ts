import { createHash } from 'node:crypto';
import { OAuthSecurityService } from './oauth-security.service';

describe('OAuthSecurityService', () => {
  const service = new OAuthSecurityService();

  it('generates URL-safe OAuth states with enough entropy', () => {
    const first = service.generateState();
    const second = service.generateState();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it('creates an S256 PKCE challenge for its verifier', () => {
    const { codeVerifier, codeChallenge } = service.createPkcePair();

    expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]{86}$/);
    expect(codeChallenge).toBe(
      createHash('sha256').update(codeVerifier, 'ascii').digest('base64url'),
    );
  });

  it('hashes states without returning their plaintext', () => {
    const state = service.generateState();
    const stateHash = service.hashState(state);

    expect(stateHash).not.toBe(state);
    expect(stateHash).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(service.hashState(state)).toBe(stateHash);
  });
});
