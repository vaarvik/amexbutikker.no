import type {
  PasskeyCeremony,
  PasskeyChallengeService,
  PasskeyInviteValidator,
  PasskeyOptionsOutput,
  RateLimiter,
  StartPasskeyRegistration,
  StartPasskeyRegistrationInput,
} from '@amexbutikker/contracts';

export class StartPasskeyRegistrationUseCase implements StartPasskeyRegistration {
  public constructor(
    private readonly invites: PasskeyInviteValidator,
    private readonly challenges: PasskeyChallengeService,
    private readonly ceremony: PasskeyCeremony,
    private readonly rateLimiter: RateLimiter,
  ) {}

  public async execute(input: StartPasskeyRegistrationInput): Promise<PasskeyOptionsOutput> {
    await this.rateLimiter.consume({ action: 'start_passkey_registration', key: input.clientKey });
    this.invites.validate(input.inviteCode);
    const options = await this.ceremony.registrationOptions(this.challenges.issue('register'));
    return { options };
  }
}
