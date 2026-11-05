import type { Clock, PlaceSummaryDto } from '@amexbutikker/contracts';
import { EMPTY_VISIT_STATE } from './visits.model';
import type {
  RegionMonitor,
  VisitNotifier,
  VisitPromptDecider,
  VisitRegionSelector,
  VisitService,
  VisitStateStorage,
} from './visits.ports';

/**
 * Visit detection on top of OS geofences. All state stays in local storage; nothing here
 * talks to the API. An answer from a notification is sent by the screen that handles it.
 */
export class GeofenceVisitService implements VisitService {
  public constructor(
    private readonly monitor: RegionMonitor,
    private readonly notifier: VisitNotifier,
    private readonly selector: VisitRegionSelector,
    private readonly decider: VisitPromptDecider,
    private readonly storage: VisitStateStorage,
    private readonly clock: Clock,
  ) {}

  public async isEnabled(): Promise<boolean> {
    return (await this.storage.find()).enabled;
  }

  public async enable(): Promise<boolean> {
    if (!(await this.notifier.requestPermission()) || !(await this.monitor.requestPermission())) {
      return false;
    }
    await this.storage.save({ ...(await this.storage.find()), enabled: true });
    return true;
  }

  public async disable(): Promise<void> {
    await this.monitor.stop();
    // Forget the regions and visits too; only the rate limits are kept.
    const state = await this.storage.find();
    await this.storage.save({
      ...EMPTY_VISIT_STATE,
      askedAt: state.askedAt,
      announcedAt: state.announcedAt,
      recentAsks: state.recentAsks,
    });
  }

  public async refresh(results: readonly PlaceSummaryDto[]): Promise<void> {
    const state = await this.storage.find();
    if (!state.enabled) {
      return;
    }
    const regions = this.selector.select(results);
    const ids = new Set<string>(regions.map((region) => region.placeId));
    // Keep the enter times of regions that are still watched, so a dwell survives a refresh.
    const enteredAt = Object.fromEntries(
      Object.entries(state.enteredAt).filter(([placeId]) => ids.has(placeId)),
    );
    await this.storage.save({ ...state, regions, enteredAt });
    await this.monitor.start(regions);
  }

  public async handle(payload: unknown): Promise<void> {
    const event = this.monitor.toEvent(payload);
    if (event === null) {
      return;
    }
    const before = await this.storage.find();
    if (!before.enabled) {
      return;
    }
    const { state, prompt } = this.decider.decide(before, event, this.clock.now());
    await this.storage.save(state);
    if (prompt !== null) {
      await this.notifier.show(prompt);
    }
  }

  public async sendTest(): Promise<boolean> {
    const region = (await this.storage.find()).regions.find(
      (candidate) => candidate.prompt === 'ask',
    );
    if (region === undefined) {
      return false;
    }
    await this.notifier.show({ kind: 'ask', placeId: region.placeId, name: region.name });
    return true;
  }
}
