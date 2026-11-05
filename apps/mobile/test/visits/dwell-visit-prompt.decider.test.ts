import type { PlaceId } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { DwellVisitPromptDecider } from '../../src/visits/dwell-visit-prompt.decider';
import type { RankedVisitCandidate, VisitRegion, VisitState } from '../../src/visits/visits.model';
import type { VisitCandidateRanker } from '../../src/visits/visits.ports';
import { ANNOUNCE_ID, ASK_ID, candidate, enabledState, region } from './visits-test.data';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const OTHER_ID = '0190a000-0000-7000-8000-0000000000a3' as PlaceId;
const THIRD_ID = '0190a000-0000-7000-8000-0000000000a4' as PlaceId;

/** Scores each place from a fixed table and records what it was asked to rank. */
class TableRanker implements VisitCandidateRanker {
  public seen: { placeId: string; insideMs: number }[][] = [];
  public constructor(private readonly scores: Readonly<Record<string, number>> = {}) {}
  public rank(stays: readonly { region: VisitRegion; insideMs: number }[]) {
    this.seen.push(stays.map((s) => ({ placeId: s.region.placeId, insideMs: s.insideMs })));
    return stays
      .map(({ region: r, insideMs }): RankedVisitCandidate => ({
        candidate: { placeId: r.placeId, name: r.name, category: r.category },
        insideMs,
        score: this.scores[r.placeId] ?? 1,
      }))
      .sort((a, b) => b.score - a.score);
  }
}

const config = {
  minDwellMs: 3 * MIN,
  askCooldownMs: 30 * DAY,
  minGapBetweenAsksMs: 10 * MIN,
  maxAsksPerDay: 3,
  announceCooldownMs: DAY,
  minLead: 0.15,
  maxCandidates: 2,
};
const t0 = new Date('2026-11-05T12:00:00.000Z');
const after = (ms: number) => new Date(t0.getTime() + ms);

/** Enters every place at t0, leaves them in the given order after `dwellMs`. */
function visit(
  decider: DwellVisitPromptDecider,
  state: VisitState,
  dwellMs: number,
  placeIds: readonly PlaceId[] = [ASK_ID],
) {
  let current = { state, prompt: null as ReturnType<DwellVisitPromptDecider['decide']>['prompt'] };
  for (const placeId of placeIds) {
    current = decider.decide(current.state, { kind: 'enter', placeId }, t0);
  }
  for (const placeId of placeIds) {
    current = decider.decide(current.state, { kind: 'exit', placeId }, after(dwellMs));
  }
  return current;
}

const threeShops = enabledState({
  regions: [
    region(ASK_ID, 'ask', 'Narvesen', 'shop'),
    region(OTHER_ID, 'ask', 'Burger King', 'fast_food'),
    region(THIRD_ID, 'ask', 'Ichi', 'shop'),
  ],
});

describe('DwellVisitPromptDecider', () => {
  const decider = new DwellVisitPromptDecider(new TableRanker(), config);

  it('asks about the one place on leaving after the minimum dwell', () => {
    const { state, prompt } = visit(decider, enabledState(), 3 * MIN);

    expect(prompt).toEqual({ kind: 'ask', candidate: candidate(ASK_ID) });
    expect(state.stays).toEqual([]);
    expect(state.askedAt[ASK_ID]).toBe(after(3 * MIN).toISOString());
    expect(state.recentAsks).toEqual([after(3 * MIN).toISOString()]);
  });

  it('records a stay on arrival without asking', () => {
    const { state, prompt } = decider.decide(
      enabledState(),
      { kind: 'enter', placeId: ASK_ID },
      t0,
    );

    expect(prompt).toBeNull();
    expect(state.stays).toEqual([{ placeId: ASK_ID, enteredAt: t0.toISOString(), insideMs: 0 }]);
  });

  it('does not ask after walking past', () => {
    expect(visit(decider, enabledState(), 3 * MIN - 1).prompt).toBeNull();
  });

  it('adds up time inside when the phone steps out and back in during a visit', () => {
    const regions = [region(ASK_ID, 'ask'), region(OTHER_ID, 'ask', 'Stor fence')];
    let step = decider.decide(enabledState({ regions }), { kind: 'enter', placeId: OTHER_ID }, t0);
    step = decider.decide(step.state, { kind: 'enter', placeId: ASK_ID }, t0);
    step = decider.decide(step.state, { kind: 'exit', placeId: ASK_ID }, after(2 * MIN));
    step = decider.decide(step.state, { kind: 'enter', placeId: ASK_ID }, after(3 * MIN));
    step = decider.decide(step.state, { kind: 'exit', placeId: ASK_ID }, after(4 * MIN));

    expect(step.prompt).toBeNull();
    expect(step.state.stays).toContainEqual({
      placeId: ASK_ID,
      enteredAt: null,
      insideMs: 3 * MIN,
    });
  });

  it('waits until the phone has left every fence of the visit', () => {
    const ranker = new TableRanker({ [ASK_ID]: 1, [OTHER_ID]: 0.5 });
    const leads = new DwellVisitPromptDecider(ranker, config);
    let step = leads.decide(threeShops, { kind: 'enter', placeId: ASK_ID }, t0);
    step = leads.decide(step.state, { kind: 'enter', placeId: OTHER_ID }, t0);
    step = leads.decide(step.state, { kind: 'exit', placeId: ASK_ID }, after(5 * MIN));
    expect(step.prompt).toBeNull();

    step = leads.decide(step.state, { kind: 'exit', placeId: OTHER_ID }, after(6 * MIN));
    expect(step.prompt).toEqual({ kind: 'ask', candidate: candidate(ASK_ID, 'Narvesen', 'shop') });
    // Ranked in region order (nearest first) with the time spent inside each fence.
    expect(ranker.seen).toEqual([
      [
        { placeId: ASK_ID, insideMs: 5 * MIN },
        { placeId: OTHER_ID, insideMs: 6 * MIN },
      ],
    ]);
  });

  it('lists the likely places when none clearly leads, up to the maximum', () => {
    const close = new DwellVisitPromptDecider(
      new TableRanker({ [ASK_ID]: 0.9, [OTHER_ID]: 0.8, [THIRD_ID]: 0.7 }),
      config,
    );
    const { state, prompt } = visit(close, threeShops, 5 * MIN, [ASK_ID, OTHER_ID, THIRD_ID]);

    expect(prompt).toEqual({
      kind: 'pick',
      candidates: [
        candidate(ASK_ID, 'Narvesen', 'shop'),
        candidate(OTHER_ID, 'Burger King', 'fast_food'),
      ],
    });
    expect(Object.keys(state.askedAt)).toEqual([ASK_ID, OTHER_ID]);
    expect(state.recentAsks).toHaveLength(1);
  });

  it('leaves out places asked about recently and places it only announces', () => {
    const ranker = new TableRanker();
    const state = enabledState({
      regions: [...threeShops.regions, region(ANNOUNCE_ID, 'announce', 'Bar Boka')],
      askedAt: { [OTHER_ID]: after(-DAY).toISOString() },
    });

    const { prompt } = visit(new DwellVisitPromptDecider(ranker, config), state, 5 * MIN, [
      ASK_ID,
      OTHER_ID,
      ANNOUNCE_ID,
    ]);

    expect(prompt).toEqual({ kind: 'ask', candidate: candidate(ASK_ID, 'Narvesen', 'shop') });
    expect(ranker.seen[0]?.map((s) => s.placeId)).toEqual([ASK_ID]);
  });

  it('asks about a place again once the cooldown has passed', () => {
    const askedLongAgo = enabledState({ askedAt: { [ASK_ID]: after(-31 * DAY).toISOString() } });

    expect(visit(decider, askedLongAgo, 5 * MIN).prompt).not.toBeNull();
  });

  it('leaves a gap between questions', () => {
    const justAsked = enabledState({ recentAsks: [after(-5 * MIN).toISOString()] });

    expect(visit(decider, justAsked, 3 * MIN).prompt).toBeNull();
  });

  it('asks at most the daily maximum, counting only the last 24 hours', () => {
    const three = [-23 * 60, -12 * 60, -60].map((m) => after(m * MIN).toISOString());
    const oneExpired = [-25 * 60, -12 * 60, -60].map((m) => after(m * MIN).toISOString());

    expect(visit(decider, enabledState({ recentAsks: three }), 3 * MIN).prompt).toBeNull();
    const { prompt, state } = visit(decider, enabledState({ recentAsks: oneExpired }), 3 * MIN);
    expect(prompt).not.toBeNull();
    expect(state.recentAsks).toHaveLength(3);
  });

  it('announces an accepted place on arrival, at most once a day', () => {
    const enter = { kind: 'enter', placeId: ANNOUNCE_ID } as const;
    const first = decider.decide(enabledState(), enter, t0);
    const sameDay = decider.decide(first.state, enter, after(DAY - 1));
    const nextDay = decider.decide(first.state, enter, after(DAY));

    expect(first.prompt).toEqual({
      kind: 'announce',
      candidate: candidate(ANNOUNCE_ID, 'Bar Boka'),
    });
    expect(sameDay.prompt).toBeNull();
    expect(nextDay.prompt).not.toBeNull();
  });

  it('ignores an exit without an enter, and events for regions it does not watch', () => {
    const state = enabledState();

    expect(decider.decide(state, { kind: 'exit', placeId: ASK_ID }, t0)).toEqual({
      state,
      prompt: null,
    });
    expect(decider.decide(state, { kind: 'enter', placeId: 'other' }, t0)).toEqual({
      state,
      prompt: null,
    });
  });

  it('does not count a second enter while already inside', () => {
    let step = decider.decide(enabledState(), { kind: 'enter', placeId: ASK_ID }, t0);
    step = decider.decide(step.state, { kind: 'enter', placeId: ASK_ID }, after(2 * MIN));

    expect(step.state.stays).toEqual([
      { placeId: ASK_ID, enteredAt: t0.toISOString(), insideMs: 0 },
    ]);
  });
});
