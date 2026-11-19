import type {
  PasskeyCeremony,
  PasskeyChallengeService,
  PasskeyOptionsOutput,
  StartPasskeySignIn,
} from '@amexbutikker/contracts';

export class StartPasskeySignInUseCase implements StartPasskeySignIn {
  public constructor(
    private readonly challenges: PasskeyChallengeService,
    private readonly ceremony: PasskeyCeremony,
  ) {}

  public async execute(): Promise<PasskeyOptionsOutput> {
    const options = await this.ceremony.signInOptions(this.challenges.issue('sign_in'));
    return { options };
  }
}
