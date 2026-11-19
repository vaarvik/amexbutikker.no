import { ApiError } from '../shared/fetch-json.transport';
import type { AccessState } from './access.model';
import type { AccessApiClient, AccessService, PasskeyPrompt } from './access.ports';

export class PasskeyAccessService implements AccessService {
  public constructor(
    private readonly api: AccessApiClient,
    /** null where the platform has no passkeys (the native app); signing in then fails. */
    private readonly prompt: PasskeyPrompt | null,
  ) {}

  public async check(): Promise<AccessState> {
    try {
      await this.api.renew();
      return 'signed_in';
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return 'signed_out';
      }
      // 404: this API has no sign-in. No answer: let the app work offline; the API still refuses.
      return 'open';
    }
  }

  public async signIn(): Promise<void> {
    const prompt = this.requirePrompt();
    const credential = await prompt.get(await this.api.signInOptions());
    await this.api.signIn(credential);
  }

  public async register(inviteCode: string): Promise<void> {
    const prompt = this.requirePrompt();
    const credential = await prompt.create(await this.api.registrationOptions(inviteCode.trim()));
    await this.api.register(credential);
  }

  private requirePrompt(): PasskeyPrompt {
    if (this.prompt === null) {
      throw new Error('Passkeys work only in the browser.');
    }
    return this.prompt;
  }
}
