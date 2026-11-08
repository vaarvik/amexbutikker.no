import type {
  AttestationChallengeService,
  IssueAttestationChallenge,
  IssueAttestationChallengeInput,
  IssueAttestationChallengeOutput,
} from '@amexbutikker/contracts';

export class IssueAttestationChallengeUseCase implements IssueAttestationChallenge {
  public constructor(private readonly challenges: AttestationChallengeService) {}

  public execute(input: IssueAttestationChallengeInput): Promise<IssueAttestationChallengeOutput> {
    return Promise.resolve({ challenge: this.challenges.issue(input.userId) });
  }
}
