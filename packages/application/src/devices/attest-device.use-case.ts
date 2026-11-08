import type {
  AppAttestValidator,
  AttestDevice,
  AttestDeviceInput,
  AttestDeviceOutput,
  AttestationChallengeService,
  Clock,
  DeviceWriter,
  RateLimiter,
  TurnstileValidator,
} from '@amexbutikker/contracts';

export class AttestDeviceUseCase implements AttestDevice {
  public constructor(
    private readonly devices: DeviceWriter,
    private readonly challenges: AttestationChallengeService,
    private readonly appAttest: AppAttestValidator,
    private readonly turnstile: TurnstileValidator,
    private readonly clock: Clock,
    private readonly rateLimiter: RateLimiter,
  ) {}

  public async execute(input: AttestDeviceInput): Promise<AttestDeviceOutput> {
    await this.rateLimiter.consume({ action: 'attest_device', key: input.userId });
    const { proof } = input;
    if (proof.kind === 'app_attest') {
      this.challenges.verify(input.userId, proof.challenge);
      await this.appAttest.validate(proof);
    } else {
      await this.turnstile.validate(proof.token);
    }
    await this.devices.saveAttestation(input.userId, {
      kind: proof.kind,
      attestedAt: this.clock.now(),
      keyId: proof.kind === 'app_attest' ? proof.keyId : null,
    });
    return { kind: proof.kind };
  }
}
