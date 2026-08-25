import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

@Injectable()
export class OAuthSecurityService {
  generateState(): string {
    return randomBytes(32).toString('base64url');
  }

  hashState(state: string): string {
    return createHash('sha256').update(state, 'utf8').digest('base64url');
  }

  createPkcePair(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = randomBytes(64).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier, 'ascii')
      .digest('base64url');

    return { codeVerifier, codeChallenge };
  }
}
