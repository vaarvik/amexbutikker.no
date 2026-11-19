import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import type { PasskeyCredential, PasskeyOptions } from '@amexbutikker/contracts';
import type { PasskeyPrompt } from './access.ports';

/** WebAuthn through @simplewebauthn/browser. The API built the options; it checks the result. */
export class BrowserPasskeyClient implements PasskeyPrompt {
  public async create(options: PasskeyOptions): Promise<PasskeyCredential> {
    return {
      ...(await startRegistration({
        optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON,
      })),
    };
  }

  public async get(options: PasskeyOptions): Promise<PasskeyCredential> {
    return {
      ...(await startAuthentication({
        optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON,
      })),
    };
  }
}
