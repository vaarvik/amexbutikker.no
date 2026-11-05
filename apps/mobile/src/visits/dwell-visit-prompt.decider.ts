import type { VisitEvent, VisitPrompt, VisitState } from './visits.model';
import type { VisitPromptDecider } from './visits.ports';

export interface DwellVisitPromptDeciderConfig {
  /** Ask only after the phone was inside at least this long; a walk past is not a visit. */
  readonly minDwellMs: number;
  /** At most one question per place in this period. */
  readonly askCooldownMs: number;
  /** Overlapping fences report several exits at once; ask about one of them only. */
  readonly minGapBetweenAsksMs: number;
  /** At most this many questions in 24 hours. */
  readonly maxAsksPerDay: number;
  /** At most one "Amex works here" per place in this period. */
  readonly announceCooldownMs: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Announces accepted places on arrival and asks about the others on leaving, after a dwell,
 * within the rate limits. Every decision is recorded in the returned state.
 */
export class DwellVisitPromptDecider implements VisitPromptDecider {
  public constructor(private readonly config: DwellVisitPromptDeciderConfig) {}

  public decide(
    state: VisitState,
    event: VisitEvent,
    now: Date,
  ): { readonly state: VisitState; readonly prompt: VisitPrompt | null } {
    const region = state.regions.find((candidate) => candidate.placeId === event.placeId);
    if (region === undefined) {
      return { state, prompt: null };
    }
    const at = now.toISOString();
    const prompt: VisitPrompt = { kind: region.prompt, placeId: region.placeId, name: region.name };

    if (event.kind === 'enter') {
      const entered = { ...state, enteredAt: { ...state.enteredAt, [region.placeId]: at } };
      if (
        region.prompt !== 'announce' ||
        this.within(state.announcedAt[region.placeId], now, this.config.announceCooldownMs)
      ) {
        return { state: entered, prompt: null };
      }
      return {
        state: { ...entered, announcedAt: { ...state.announcedAt, [region.placeId]: at } },
        prompt,
      };
    }

    const { [region.placeId]: enteredAt, ...stillInside } = state.enteredAt;
    const left = { ...state, enteredAt: stillInside };
    const recentAsks = state.recentAsks.filter((asked) => this.within(asked, now, DAY_MS));
    const lastAsk = recentAsks.at(-1);
    const dwelt =
      enteredAt !== undefined && now.getTime() - Date.parse(enteredAt) >= this.config.minDwellMs;
    if (
      region.prompt !== 'ask' ||
      !dwelt ||
      this.within(state.askedAt[region.placeId], now, this.config.askCooldownMs) ||
      this.within(lastAsk, now, this.config.minGapBetweenAsksMs) ||
      recentAsks.length >= this.config.maxAsksPerDay
    ) {
      return { state: { ...left, recentAsks }, prompt: null };
    }
    return {
      state: {
        ...left,
        askedAt: { ...state.askedAt, [region.placeId]: at },
        recentAsks: [...recentAsks, at],
      },
      prompt,
    };
  }

  /** True when `iso` is less than `periodMs` before `now`. */
  private within(iso: string | undefined, now: Date, periodMs: number): boolean {
    return iso !== undefined && now.getTime() - Date.parse(iso) < periodMs;
  }
}
