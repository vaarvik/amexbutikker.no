import { describe, expect, it } from 'vitest';
import { DwellVisitPromptDecider } from '../../src/visits/dwell-visit-prompt.decider';
import type { VisitState } from '../../src/visits/visits.model';
import { ANNOUNCE_ID, ASK_ID, enabledState } from './visits-test.data';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const decider = new DwellVisitPromptDecider({
  minDwellMs: 3 * MIN,
  askCooldownMs: 30 * DAY,
  minGapBetweenAsksMs: 10 * MIN,
  maxAsksPerDay: 3,
  announceCooldownMs: DAY,
});
const t0 = new Date('2026-11-05T12:00:00.000Z');
const after = (ms: number) => new Date(t0.getTime() + ms);

/** Enters at t0, leaves after `dwellMs`. */
function visit(state: VisitState, dwellMs: number) {
  const entered = decider.decide(state, { kind: 'enter', placeId: ASK_ID }, t0);
  return decider.decide(entered.state, { kind: 'exit', placeId: ASK_ID }, after(dwellMs));
}

describe('DwellVisitPromptDecider', () => {
  it('asks on leaving after the minimum dwell', () => {
    const { state, prompt } = visit(enabledState(), 3 * MIN);

    expect(prompt).toEqual({ kind: 'ask', placeId: ASK_ID, name: 'Kafé Åsen' });
    expect(state.enteredAt).toEqual({});
    expect(state.askedAt[ASK_ID]).toBe(after(3 * MIN).toISOString());
    expect(state.recentAsks).toEqual([after(3 * MIN).toISOString()]);
  });

  it('does not ask on arrival', () => {
    const { state, prompt } = decider.decide(
      enabledState(),
      { kind: 'enter', placeId: ASK_ID },
      t0,
    );

    expect(prompt).toBeNull();
    expect(state.enteredAt[ASK_ID]).toBe(t0.toISOString());
  });

  it('does not ask after walking past', () => {
    expect(visit(enabledState(), 3 * MIN - 1).prompt).toBeNull();
  });

  it('does not ask on leaving a place it never saw the phone enter', () => {
    const { prompt } = decider.decide(enabledState(), { kind: 'exit', placeId: ASK_ID }, t0);

    expect(prompt).toBeNull();
  });

  it('asks about a place at most once per cooldown', () => {
    const asked = enabledState({ askedAt: { [ASK_ID]: after(-29 * DAY).toISOString() } });
    const askedLongAgo = enabledState({ askedAt: { [ASK_ID]: after(-31 * DAY).toISOString() } });

    expect(visit(asked, 5 * MIN).prompt).toBeNull();
    expect(visit(askedLongAgo, 5 * MIN).prompt).not.toBeNull();
  });

  it('leaves a gap between questions, so overlapping fences ask only once', () => {
    const justAsked = enabledState({ recentAsks: [after(-5 * MIN).toISOString()] });

    expect(visit(justAsked, 3 * MIN).prompt).toBeNull();
  });

  it('asks at most the daily maximum, counting only the last 24 hours', () => {
    const three = [-23 * 60, -12 * 60, -60].map((m) => after(m * MIN).toISOString());
    const oneExpired = [-25 * 60, -12 * 60, -60].map((m) => after(m * MIN).toISOString());

    expect(visit(enabledState({ recentAsks: three }), 3 * MIN).prompt).toBeNull();
    const { prompt, state } = visit(enabledState({ recentAsks: oneExpired }), 3 * MIN);
    expect(prompt).not.toBeNull();
    expect(state.recentAsks).toHaveLength(3);
  });

  it('announces an accepted place on arrival, at most once a day', () => {
    const enter = { kind: 'enter', placeId: ANNOUNCE_ID } as const;
    const first = decider.decide(enabledState(), enter, t0);
    const sameDay = decider.decide(first.state, enter, after(DAY - 1));
    const nextDay = decider.decide(first.state, enter, after(DAY));

    expect(first.prompt).toEqual({ kind: 'announce', placeId: ANNOUNCE_ID, name: 'Bar Boka' });
    expect(sameDay.prompt).toBeNull();
    expect(nextDay.prompt).not.toBeNull();
  });

  it('never asks about an announced place', () => {
    const entered = decider.decide(enabledState(), { kind: 'enter', placeId: ANNOUNCE_ID }, t0);
    const left = decider.decide(
      entered.state,
      { kind: 'exit', placeId: ANNOUNCE_ID },
      after(10 * MIN),
    );

    expect(left.prompt).toBeNull();
  });

  it('ignores events for regions it does not watch', () => {
    const state = enabledState();
    const result = decider.decide(state, { kind: 'enter', placeId: 'other' }, t0);

    expect(result).toEqual({ state, prompt: null });
  });
});
