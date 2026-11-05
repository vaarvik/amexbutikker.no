import type {
  VisitCandidate,
  VisitEvent,
  VisitPrompt,
  VisitRegion,
  VisitState,
  VisitStay,
} from './visits.model';
import type { VisitCandidateRanker, VisitPromptDecider } from './visits.ports';

export interface DwellVisitPromptDeciderConfig {
  /** A place is a candidate only after the phone was inside its fence this long. */
  readonly minDwellMs: number;
  /** At most one question per place in this period. */
  readonly askCooldownMs: number;
  /** At least this long between two questions. */
  readonly minGapBetweenAsksMs: number;
  /** At most this many questions in 24 hours. */
  readonly maxAsksPerDay: number;
  /** At most one "Amex works here" per place in this period. */
  readonly announceCooldownMs: number;
  /** The best candidate is named alone when its score leads the next by at least this. */
  readonly minLead: number;
  /** At most this many places in a pick list. */
  readonly maxCandidates: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Announces accepted places on arrival. Collects a visit from the first enter until the phone
 * has left every fence, then asks about the most likely place, or lists the likely places when
 * none stands out. Every decision is recorded in the returned state.
 */
export class DwellVisitPromptDecider implements VisitPromptDecider {
  public constructor(
    private readonly ranker: VisitCandidateRanker,
    private readonly config: DwellVisitPromptDeciderConfig,
  ) {}

  public decide(
    state: VisitState,
    event: VisitEvent,
    now: Date,
  ): { readonly state: VisitState; readonly prompt: VisitPrompt | null } {
    const region = state.regions.find((candidate) => candidate.placeId === event.placeId);
    if (region === undefined) {
      return { state, prompt: null };
    }
    return event.kind === 'enter' ? this.enter(state, region, now) : this.exit(state, region, now);
  }

  private enter(
    state: VisitState,
    region: VisitRegion,
    now: Date,
  ): { readonly state: VisitState; readonly prompt: VisitPrompt | null } {
    const at = now.toISOString();
    const existing = state.stays.find((stay) => stay.placeId === region.placeId);
    const stay: VisitStay = {
      placeId: region.placeId,
      enteredAt: existing?.enteredAt ?? at,
      insideMs: existing?.insideMs ?? 0,
    };
    const entered = { ...state, stays: this.replace(state.stays, stay) };
    if (
      region.prompt !== 'announce' ||
      this.within(state.announcedAt[region.placeId], now, this.config.announceCooldownMs)
    ) {
      return { state: entered, prompt: null };
    }
    return {
      state: { ...entered, announcedAt: { ...state.announcedAt, [region.placeId]: at } },
      prompt: { kind: 'announce', candidate: this.candidate(region) },
    };
  }

  private exit(
    state: VisitState,
    region: VisitRegion,
    now: Date,
  ): { readonly state: VisitState; readonly prompt: VisitPrompt | null } {
    const stay = state.stays.find((candidate) => candidate.placeId === region.placeId);
    if (stay === undefined || stay.enteredAt === null) {
      return { state, prompt: null };
    }
    const left: VisitStay = {
      placeId: stay.placeId,
      enteredAt: null,
      insideMs: stay.insideMs + Math.max(0, now.getTime() - Date.parse(stay.enteredAt)),
    };
    const stays = this.replace(state.stays, left);
    if (stays.some((candidate) => candidate.enteredAt !== null)) {
      // Still inside another fence of the same visit.
      return { state: { ...state, stays }, prompt: null };
    }
    return this.finish({ ...state, stays: [] }, stays, now);
  }

  /** The visit is over: rank its places and decide what to ask. */
  private finish(
    state: VisitState,
    stays: readonly VisitStay[],
    now: Date,
  ): { readonly state: VisitState; readonly prompt: VisitPrompt | null } {
    const recentAsks = state.recentAsks.filter((asked) => this.within(asked, now, DAY_MS));
    const cleared = { ...state, recentAsks };
    if (
      this.within(recentAsks.at(-1), now, this.config.minGapBetweenAsksMs) ||
      recentAsks.length >= this.config.maxAsksPerDay
    ) {
      return { state: cleared, prompt: null };
    }
    // In region order, which is nearest first, so the ranker breaks ties towards the nearest.
    const eligible = state.regions.flatMap((region) => {
      const stay = stays.find((candidate) => candidate.placeId === region.placeId);
      return stay !== undefined &&
        region.prompt === 'ask' &&
        stay.insideMs >= this.config.minDwellMs &&
        !this.within(state.askedAt[region.placeId], now, this.config.askCooldownMs)
        ? [{ region, insideMs: stay.insideMs }]
        : [];
    });
    const ranked = this.ranker.rank(eligible);
    const [first, second] = ranked;
    if (first === undefined) {
      return { state: cleared, prompt: null };
    }
    const prompt: VisitPrompt =
      second === undefined || first.score - second.score >= this.config.minLead
        ? { kind: 'ask', candidate: first.candidate }
        : {
            kind: 'pick',
            candidates: ranked.slice(0, this.config.maxCandidates).map((r) => r.candidate),
          };
    const asked = prompt.kind === 'ask' ? [prompt.candidate] : prompt.candidates;
    const at = now.toISOString();
    return {
      state: {
        ...cleared,
        askedAt: {
          ...state.askedAt,
          ...Object.fromEntries(asked.map((candidate) => [candidate.placeId, at])),
        },
        recentAsks: [...recentAsks, at],
      },
      prompt,
    };
  }

  private candidate(region: VisitRegion): VisitCandidate {
    return { placeId: region.placeId, name: region.name, category: region.category };
  }

  private replace(stays: readonly VisitStay[], stay: VisitStay): readonly VisitStay[] {
    return [...stays.filter((candidate) => candidate.placeId !== stay.placeId), stay];
  }

  /** True when `iso` is less than `periodMs` before `now`. */
  private within(iso: string | undefined, now: Date, periodMs: number): boolean {
    return iso !== undefined && now.getTime() - Date.parse(iso) < periodMs;
  }
}
