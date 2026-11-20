import { describe, expect, it } from 'vitest';
import { UrlHouseholdInviteTranslator } from '../../src/households/url-household-invite.translator';
import { HOUSEHOLD_ID } from './household-test.data';

const KEY = 'A'.repeat(42) + 'Q';
const translator = new UrlHouseholdInviteTranslator({ webOrigin: null });
const web = new UrlHouseholdInviteTranslator({ webOrigin: 'https://amex.example.test' });

describe('UrlHouseholdInviteTranslator', () => {
  it('writes and reads the invite link', () => {
    const link = translator.toLink({ householdId: HOUSEHOLD_ID, key: KEY });

    expect(link).toBe(`amexbutikker://household/join?invite=${HOUSEHOLD_ID}.${KEY}`);
    expect(translator.fromLink(` ${link} `)).toEqual({ householdId: HOUSEHOLD_ID, key: KEY });
  });

  it('writes a web link with the invite after #, and reads either link', () => {
    const link = web.toLink({ householdId: HOUSEHOLD_ID, key: KEY });

    expect(link).toBe(`https://amex.example.test/household/join#invite=${HOUSEHOLD_ID}.${KEY}`);
    expect(web.fromLink(link)).toEqual({ householdId: HOUSEHOLD_ID, key: KEY });
    expect(web.fromLink(translator.toLink({ householdId: HOUSEHOLD_ID, key: KEY }))).toEqual({
      householdId: HOUSEHOLD_ID,
      key: KEY,
    });
  });

  it('reads the invite value alone, as a screen gets it', () => {
    expect(translator.fromLink(`${HOUSEHOLD_ID}.${KEY}`)).toEqual({
      householdId: HOUSEHOLD_ID,
      key: KEY,
    });
  });

  it.each(['', 'https://example.no', HOUSEHOLD_ID, `not-a-uuid.${KEY}`, `${HOUSEHOLD_ID}.short`])(
    'refuses %j',
    (text) => {
      expect(translator.fromLink(text)).toBeNull();
    },
  );
});
