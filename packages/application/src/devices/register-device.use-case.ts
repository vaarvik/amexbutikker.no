import type {
  Clock,
  DeviceTokenService,
  DeviceWriter,
  IdGenerator,
  RateLimiter,
  RegisterDevice,
  RegisterDeviceInput,
  RegisterDeviceOutput,
} from '@amexbutikker/contracts';

export class RegisterDeviceUseCase implements RegisterDevice {
  public constructor(
    private readonly devices: DeviceWriter,
    private readonly tokens: DeviceTokenService,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly rateLimiter: RateLimiter,
  ) {}

  public async execute(input: RegisterDeviceInput): Promise<RegisterDeviceOutput> {
    await this.rateLimiter.consume({ action: 'register_device', key: input.clientKey });
    const userId = this.ids.userId();
    await this.devices.register({ userId, platform: input.platform, createdAt: this.clock.now() });
    const { token } = await this.tokens.issue(userId);
    return { userId, token };
  }
}
