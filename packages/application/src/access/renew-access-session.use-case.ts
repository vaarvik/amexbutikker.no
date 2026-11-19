import { UnauthenticatedError } from '@amexbutikker/contracts';
import type {
  AccessSessionService,
  IssuedAccessSession,
  PasskeyReader,
  RenewAccessSession,
  RenewAccessSessionInput,
} from '@amexbutikker/contracts';

export class RenewAccessSessionUseCase implements RenewAccessSession {
  public constructor(
    private readonly sessions: AccessSessionService,
    private readonly passkeys: PasskeyReader,
  ) {}

  public async execute(input: RenewAccessSessionInput): Promise<IssuedAccessSession> {
    const { passkeyId } = this.sessions.verify(input.token);
    if ((await this.passkeys.findById(passkeyId)) === null) {
      throw new UnauthenticatedError('The passkey behind this session was removed.');
    }
    return this.sessions.issue(passkeyId);
  }
}
