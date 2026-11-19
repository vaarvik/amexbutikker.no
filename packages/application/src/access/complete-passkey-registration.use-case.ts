import type {
  AccessSessionService,
  Clock,
  CompletePasskeyCeremonyInput,
  CompletePasskeyRegistration,
  IssuedAccessSession,
  PasskeyCeremony,
  PasskeyChallengeService,
  PasskeyWriter,
} from '@amexbutikker/contracts';

export class CompletePasskeyRegistrationUseCase implements CompletePasskeyRegistration {
  public constructor(
    private readonly challenges: PasskeyChallengeService,
    private readonly ceremony: PasskeyCeremony,
    private readonly passkeys: PasskeyWriter,
    private readonly sessions: AccessSessionService,
    private readonly clock: Clock,
  ) {}

  public async execute(input: CompletePasskeyCeremonyInput): Promise<IssuedAccessSession> {
    const challenge = this.ceremony.challengeOf(input.credential);
    this.challenges.verify(challenge, 'register');
    const passkey = await this.ceremony.verifyRegistration(input.credential, challenge);
    await this.passkeys.create({ ...passkey, createdAt: this.clock.now() });
    return this.sessions.issue(passkey.id);
  }
}
