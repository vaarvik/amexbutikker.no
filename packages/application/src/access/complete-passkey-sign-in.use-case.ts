import { UnauthenticatedError } from '@amexbutikker/contracts';
import type {
  AccessSessionService,
  CompletePasskeyCeremonyInput,
  CompletePasskeySignIn,
  IssuedAccessSession,
  PasskeyCeremony,
  PasskeyChallengeService,
  PasskeyReader,
  PasskeyWriter,
} from '@amexbutikker/contracts';

export class CompletePasskeySignInUseCase implements CompletePasskeySignIn {
  public constructor(
    private readonly challenges: PasskeyChallengeService,
    private readonly ceremony: PasskeyCeremony,
    private readonly reader: PasskeyReader,
    private readonly writer: PasskeyWriter,
    private readonly sessions: AccessSessionService,
  ) {}

  public async execute(input: CompletePasskeyCeremonyInput): Promise<IssuedAccessSession> {
    const challenge = this.ceremony.challengeOf(input.credential);
    this.challenges.verify(challenge, 'sign_in');
    const passkey = await this.reader.findById(this.ceremony.passkeyIdOf(input.credential));
    if (passkey === null) {
      throw new UnauthenticatedError('This passkey cannot open the app.');
    }
    const counter = await this.ceremony.verifySignIn(input.credential, challenge, passkey);
    await this.writer.saveCounter(passkey.id, counter);
    return this.sessions.issue(passkey.id);
  }
}
