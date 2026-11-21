import { describe, expect, it } from 'vitest';
import { EqualSpendingShareCalculator } from '../../src/spending/equal-spending-share.calculator';
import type { Purchase } from '../../src/spending/spending.model';
import { purchase } from './spending-test.data';

const JO = { id: 'jo', name: 'Johann' };
const KARI = { id: 'kari', name: 'Kari' };

function paid(amountNok: number, paidBy: string | null, split: Purchase['split'] = 'shared') {
  return {
    ...purchase('2026-11-01', amountNok, `${String(paidBy)}-${String(amountNok)}`),
    paidBy,
    split,
  };
}

describe('EqualSpendingShareCalculator', () => {
  const calculator = new EqualSpendingShareCalculator();

  it('is null with fewer than two members', () => {
    expect(calculator.calculate([paid(100, 'jo')], [JO], 'jo')).toBeNull();
    expect(calculator.calculate([], [], 'jo')).toBeNull();
  });

  it('splits shared purchases equally and keeps private ones apart', () => {
    const shares = calculator.calculate(
      [paid(600, 'jo'), paid(200, 'kari'), paid(50, 'kari', 'private'), paid(70, null)],
      [JO, KARI],
      'jo',
    );

    expect(shares).toEqual({
      sharedNok: 800,
      members: [
        { member: JO, paidSharedNok: 600, privateNok: 0, balanceNok: 200 },
        { member: KARI, paidSharedNok: 200, privateNok: 50, balanceNok: -200 },
      ],
      unassignedNok: 70,
    });
  });

  it('counts a payer who has not named themselves', () => {
    const shares = calculator.calculate([paid(300, 'jo'), paid(0, 'other')], [JO], 'jo');

    expect(shares?.members.map((share) => [share.member, share.balanceNok])).toEqual([
      [JO, 150],
      [{ id: 'other', name: '' }, -150],
    ]);
  });

  it('rounds each balance to whole kroner', () => {
    const third = { id: 'tre', name: 'Tre' };
    const shares = calculator.calculate(
      [paid(100, 'jo'), paid(0, 'kari'), paid(0, 'tre')],
      [JO, KARI, third],
      'jo',
    );

    expect(shares?.members.map((share) => share.balanceNok)).toEqual([67, -33, -33]);
  });

  it('leaves out named members who paid nothing, such as phones that left', () => {
    const gone = { id: 'gone', name: 'Gammel telefon' };
    const shares = calculator.calculate(
      [paid(400, 'jo'), paid(100, 'kari')],
      [JO, KARI, gone],
      'jo',
    );

    expect(shares?.members.map((share) => [share.member.id, share.balanceNok])).toEqual([
      ['jo', 150],
      ['kari', -150],
    ]);
  });

  it('always counts this phone, also before it pays', () => {
    const shares = calculator.calculate([paid(100, 'kari')], [JO, KARI], 'jo');

    expect(shares?.members.map((share) => share.member.id)).toEqual(['jo', 'kari']);
  });
});
