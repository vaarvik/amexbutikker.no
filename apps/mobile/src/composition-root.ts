import type { CardReader, DevicePlatform } from '@amexbutikker/contracts';
import { CachingCardReader } from './spending/caching-card.reader';
import { CalendarYearSpendingSummarizer } from './spending/calendar-year-spending.summarizer';
import { FetchCardsApiClient } from './spending/fetch-cards-api.client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CurrentPlatform } from './composition-root.platform';
import type { AccessService, PasskeyPrompt } from './access/access.ports';
import { FetchAccessApiClient } from './access/fetch-access-api.client';
import { PasskeyAccessService } from './access/passkey-access.service';
import type {
  AppAttestModule,
  DeviceAttestationService,
  DeviceSession,
} from './devices/devices.ports';
import { FetchDevicesApiClient } from './devices/fetch-devices-api.client';
import { StoredDeviceAttestationService } from './devices/stored-device-attestation.service';
import { StoredDeviceSession } from './devices/stored-device.session';
import type { LocationProvider } from './location/location.ports';
import { CachingNearbyService } from './places/caching-nearby.service';
import { FetchPlacesApiClient } from './places/fetch-places-api.client';
import { KeyValueNearbyCache } from './places/key-value-nearby.cache';
import type { NearbyService, PlacesApiClient } from './places/places.ports';
import { KeyValueAskedPlaceStorage } from './payments/key-value-asked-place.storage';
import { KeyValueHandledPaymentStorage } from './payments/key-value-handled-payment.storage';
import { MatchingPaymentService } from './payments/matching-payment.service';
import { KeyValueWalletSetupStorage } from './payments/key-value-wallet-setup.storage';
import type {
  PaymentService,
  WalletLinkParser,
  WalletSetupStorage,
} from './payments/payments.ports';
import { ShortcutWalletLinkParser } from './payments/shortcut-wallet-link.parser';
import { FetchJsonTransport } from './shared/fetch-json.transport';
import type { KeyValueStorage, RandomBytesModule } from './shared/shared.ports';
import { ModuleRandomBytesProvider } from './shared/module-random-bytes.provider';
import { FetchHouseholdsApiClient } from './households/fetch-households-api.client';
import type { HouseholdService } from './households/households.ports';
import { KeyValueHouseholdStorage } from './households/key-value-household.storage';
import { SyncingHouseholdService } from './households/syncing-household.service';
import { UrlHouseholdInviteTranslator } from './households/url-household-invite.translator';
import { XchachaHouseholdCipher } from './households/xchacha-household.cipher';
import { ForwardingSpendingChangeNotifier } from './spending/forwarding-spending-change.notifier';
import { ReplayingSpendingStateCalculator } from './spending/replaying-spending-state.calculator';
import { SystemClock } from './shared/system.clock';
import { ClockLocalDateProvider } from './spending/clock-local-date.provider';
import { KeyValueSpendingStorage } from './spending/key-value-spending.storage';
import { NorwegianSpendingPresenter } from './spending/norwegian-spending.presenter';
import { PeriodMilestoneProgressCalculator } from './spending/period-milestone-progress.calculator';
import { RandomIdGenerator } from './spending/random-id.generator';
import type { SpendingPresenter, SpendingService } from './spending/spending.ports';
import { StoredSpendingService } from './spending/stored-spending.service';
import { EqualSpendingShareCalculator } from './spending/equal-spending-share.calculator';
import { KeyValueMemberIdProvider } from './spending/key-value-member-id.provider';
import { NorwegianStatusPresenter } from './status/norwegian-status.presenter';
import type { StatusPresenter } from './status/status.ports';
import { STATUS_COLORS } from './ui/theme';
import { CategoryDwellVisitCandidateRanker } from './visits/category-dwell-visit-candidate.ranker';
import { DwellVisitPromptDecider } from './visits/dwell-visit-prompt.decider';
import { GeofenceVisitService } from './visits/geofence-visit.service';
import { KeyValueVisitStateStorage } from './visits/key-value-visit-state.storage';
import { NearestVisitRegionSelector } from './visits/nearest-visit-region.selector';
import type { RegionMonitor, VisitNotifier, VisitService } from './visits/visits.ports';
import { SnapshotNearbyWidgetService } from './widgets/snapshot-nearby-widget.service';
import { StatusNearbyWidgetPropsMapper } from './widgets/status-nearby-widget-props.mapper';
import type { NearbyWidgetService, NearbyWidgetWriter } from './widgets/widgets.ports';

/** What the screens get through `useServices()`. */
export interface AppServices {
  /** Signing in to a private deployment; `open` everywhere else. */
  readonly access: AccessService;
  readonly places: PlacesApiClient;
  readonly nearby: NearbyService;
  readonly location: LocationProvider;
  readonly session: DeviceSession;
  /** Proves the install is real (App Attest, Turnstile), so its answers count in full. */
  readonly attestation: DeviceAttestationService;
  /** Cloudflare Turnstile site key for the web app; null turns Turnstile off. */
  readonly turnstileSiteKey: string | null;
  readonly presenter: StatusPresenter;
  /** Visit detection; null on the web. */
  readonly visits: VisitService | null;
  /** The home screen widget; does nothing where there is none. */
  readonly widgets: NearbyWidgetService;
  /** The Bonus tab: spending and milestones, stored on the phone only. */
  readonly spending: SpendingService;
  readonly spendingPresenter: SpendingPresenter;
  /** The cards to choose from (Settings → Kort): from the API, or last time's copy offline. */
  readonly cards: CardReader;
  /** Answers from Apple Wallet payments (the `paid` link the Shortcuts automation opens). */
  readonly payments: PaymentService;
  readonly walletLinks: WalletLinkParser;
  /** Whether the Apple Pay automation is set up, so the app can prompt for it once. */
  readonly walletSetup: WalletSetupStorage;
  /** Shares Bonus with the other phones in a household, sealed with a key the API never sees. */
  readonly households: HouseholdService;
  /** False on the web: native-only features (share intake, visit detection) are hidden there. */
  readonly native: boolean;
}

/** What differs per platform; built by `composition-root.platform(.web).ts`. */
export interface PlatformAdapters {
  readonly platform: DevicePlatform;
  /** Where the device token is kept: SecureStore on phones, localStorage on the web. */
  readonly tokenStorage: KeyValueStorage;
  readonly location: LocationProvider;
  /** OS geofencing and local notifications; null on the web. */
  readonly regionMonitor: RegionMonitor | null;
  readonly visitNotifier: VisitNotifier | null;
  /** The home screen widget; a Null writer where there is none. */
  readonly widgetWriter: NearbyWidgetWriter;
  /** Apple App Attest; null where there is none. */
  readonly appAttest: AppAttestModule | null;
  /** The browser's passkey dialogs; null in the native app. */
  readonly passkeys: PasskeyPrompt | null;
  /** Secure random bytes for household keys and nonces. */
  readonly randomBytes: RandomBytesModule;
  readonly native: boolean;
}

export interface MobileConfig {
  /** API base URL without a trailing slash. */
  readonly apiUrl: string;
  /** How long the phone must be inside a place before leaving it triggers a question. */
  readonly visitMinDwellMs: number;
  readonly turnstileSiteKey: string | null;
}

/** The API on this machine; phones on the LAN need EXPO_PUBLIC_API_URL set to its LAN address. */
const DEFAULT_API_URL = 'http://localhost:3000';
const DEFAULT_VISIT_MIN_DWELL_S = 180;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** The only place in the app that constructs services. */
export class CompositionRoot implements AppServices {
  public readonly access: AccessService;
  public readonly places: PlacesApiClient;
  public readonly nearby: NearbyService;
  public readonly location: LocationProvider;
  public readonly session: DeviceSession;
  public readonly attestation: DeviceAttestationService;
  public readonly turnstileSiteKey: string | null;
  public readonly presenter: StatusPresenter;
  public readonly visits: VisitService | null;
  public readonly widgets: NearbyWidgetService;
  public readonly spending: SpendingService;
  public readonly spendingPresenter: SpendingPresenter;
  public readonly cards: CardReader;
  public readonly payments: PaymentService;
  public readonly walletLinks: WalletLinkParser;
  public readonly walletSetup: WalletSetupStorage;
  public readonly households: HouseholdService;
  public readonly native: boolean;

  public constructor(config: MobileConfig, adapters: PlatformAdapters) {
    const transport = new FetchJsonTransport((url, init) => fetch(url, init), {
      baseUrl: config.apiUrl.replace(/\/+$/, ''),
      timeoutMs: 8000,
    });
    this.native = adapters.native;
    this.access = new PasskeyAccessService(new FetchAccessApiClient(transport), adapters.passkeys);
    const devicesApi = new FetchDevicesApiClient(transport);
    this.session = new StoredDeviceSession(devicesApi, adapters.tokenStorage, {
      platform: adapters.platform,
      key: 'device-token',
    });
    this.attestation = new StoredDeviceAttestationService(
      this.session,
      devicesApi,
      adapters.appAttest,
      adapters.tokenStorage,
      { key: 'device-attested-token' },
    );
    this.turnstileSiteKey = config.turnstileSiteKey;
    this.places = new FetchPlacesApiClient(transport, this.session);
    this.location = adapters.location;
    const clock = new SystemClock();
    const nearbyCache = new KeyValueNearbyCache(AsyncStorage, { key: 'nearby-snapshot-v1' });
    this.nearby = new CachingNearbyService(this.places, nearbyCache, this.location, clock, {
      radiusM: 1500,
    });
    this.presenter = new NorwegianStatusPresenter();
    // Amounts stay on the phone, except sealed for a household with a key the API never has.
    const spendingStorage = new KeyValueSpendingStorage(AsyncStorage, { key: 'spending-v1' });
    const replay = new ReplayingSpendingStateCalculator();
    const spendingChanges = new ForwardingSpendingChangeNotifier();
    this.spending = new StoredSpendingService(
      spendingStorage,
      new PeriodMilestoneProgressCalculator(),
      new ClockLocalDateProvider(clock),
      new RandomIdGenerator(),
      new CalendarYearSpendingSummarizer(),
      replay,
      spendingChanges,
      clock,
      new EqualSpendingShareCalculator(),
      new KeyValueMemberIdProvider(AsyncStorage, new RandomIdGenerator(), { key: 'member-id-v1' }),
    );
    const households = new SyncingHouseholdService(
      new FetchHouseholdsApiClient(transport, this.session),
      new XchachaHouseholdCipher(new ModuleRandomBytesProvider(adapters.randomBytes)),
      new UrlHouseholdInviteTranslator(),
      // The key in the keychain (localStorage on the web); progress next to the spending.
      new KeyValueHouseholdStorage(adapters.tokenStorage, AsyncStorage, { key: 'household-v1' }),
      spendingStorage,
      replay,
      this.spending,
      clock,
      { batchSize: 50 },
    );
    spendingChanges.attach(households);
    this.households = households;
    this.spendingPresenter = new NorwegianSpendingPresenter();
    this.cards = new CachingCardReader(new FetchCardsApiClient(transport), AsyncStorage, {
      key: 'cards-v1',
    });
    // Only the merchant name and the position reach the API; the amount goes to Bonus.
    this.payments = new MatchingPaymentService(
      this.places,
      this.location,
      this.spending,
      new KeyValueHandledPaymentStorage(AsyncStorage, { key: 'handled-payments-v1' }),
      new KeyValueAskedPlaceStorage(AsyncStorage, { key: 'asked-places-v1' }),
      clock,
      { duplicateWindowMs: 10 * MINUTE_MS, askAgainAfterMs: 30 * DAY_MS },
    );
    this.walletLinks = new ShortcutWalletLinkParser();
    this.walletSetup = new KeyValueWalletSetupStorage(AsyncStorage, { key: 'wallet-setup-v1' });
    this.widgets = new SnapshotNearbyWidgetService(
      new StatusNearbyWidgetPropsMapper(this.presenter, {
        hereWithinM: 60,
        maxAccepted: 4,
        placeUrl: 'amexbutikker://place/',
        colors: STATUS_COLORS,
      }),
      adapters.widgetWriter,
      nearbyCache,
      clock,
    );
    this.visits =
      adapters.regionMonitor === null || adapters.visitNotifier === null
        ? null
        : new GeofenceVisitService(
            adapters.regionMonitor,
            adapters.visitNotifier,
            new NearestVisitRegionSelector({ maxRegions: 18, radiusM: 75 }),
            new DwellVisitPromptDecider(
              new CategoryDwellVisitCandidateRanker({
                dwellRanges: {
                  shop: { minMs: 1 * MINUTE_MS, maxMs: 30 * MINUTE_MS },
                  cafe: { minMs: 5 * MINUTE_MS, maxMs: 60 * MINUTE_MS },
                  fast_food: { minMs: 5 * MINUTE_MS, maxMs: 40 * MINUTE_MS },
                  restaurant: { minMs: 30 * MINUTE_MS, maxMs: 150 * MINUTE_MS },
                  bar: { minMs: 20 * MINUTE_MS, maxMs: 180 * MINUTE_MS },
                  pub: { minMs: 20 * MINUTE_MS, maxMs: 180 * MINUTE_MS },
                  hotel: { minMs: 10 * MINUTE_MS, maxMs: 600 * MINUTE_MS },
                  online_shop: { minMs: 1 * MINUTE_MS, maxMs: 30 * MINUTE_MS },
                  other: { minMs: 2 * MINUTE_MS, maxMs: 60 * MINUTE_MS },
                },
                timeWeight: 0.6,
                categoryWeight: 0.4,
              }),
              {
                minDwellMs: config.visitMinDwellMs,
                askCooldownMs: 30 * DAY_MS,
                minGapBetweenAsksMs: 10 * MINUTE_MS,
                maxAsksPerDay: 3,
                announceCooldownMs: DAY_MS,
                minLead: 0.15,
                maxCandidates: 5,
              },
            ),
            // v2: visits are tracked as stays across overlapping fences.
            new KeyValueVisitStateStorage(AsyncStorage, { key: 'visit-state-v2' }),
            nearbyCache,
            this.widgets,
            clock,
          );
  }

  public static fromEnv(): CompositionRoot {
    return new CompositionRoot(
      {
        // Expo inlines EXPO_PUBLIC_* at build time; it must be read as this exact expression.
        apiUrl: CompositionRoot.nonEmpty(process.env.EXPO_PUBLIC_API_URL) ?? DEFAULT_API_URL,
        // Lower it (e.g. 20) to try visit detection in the simulator without waiting minutes.
        visitMinDwellMs:
          Number(
            CompositionRoot.nonEmpty(process.env.EXPO_PUBLIC_VISIT_MIN_DWELL_SECONDS) ??
              DEFAULT_VISIT_MIN_DWELL_S,
          ) * 1000,
        turnstileSiteKey: CompositionRoot.nonEmpty(process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY),
      },
      new CurrentPlatform(),
    );
  }

  private static nonEmpty(value: unknown): string | null {
    return typeof value === 'string' && value !== '' ? value : null;
  }
}
