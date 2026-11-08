import { describe, expect, it } from 'vitest';
import { ShortcutWalletLinkParser } from '../../src/payments/shortcut-wallet-link.parser';

describe('ShortcutWalletLinkParser', () => {
  const parser = new ShortcutWalletLinkParser();

  it('reads the merchant and the amount', () => {
    expect(parser.parse({ merchant: ' Kaffebrenneriet ', amount: 'kr 49,00' })).toEqual({
      merchant: 'Kaffebrenneriet',
      amountNok: 49,
    });
  });

  it.each([
    ['249', 249],
    ['249,00 kr', 249],
    ['kr 1 299,50', 1300],
    ['1 299,49 kr', 1299],
    ['NOK 249.00', 249],
    ['1.299,50', 1300],
    ['1,299.50', 1300],
    ['1.299', 1299],
    ['12 500', 12500],
    ['249,-', 249],
  ])('reads %j as %d kroner', (amount, nok) => {
    expect(parser.parse({ merchant: 'X', amount })?.amountNok).toBe(nok);
  });

  it.each(['$12.00', '€5,00', '12,00 EUR', 'SEK 100', '', 'gratis', '0', '0,40', '-50', '1e9'])(
    'leaves out the amount %j',
    (amount) => {
      expect(parser.parse({ merchant: 'X', amount })).toEqual({ merchant: 'X', amountNok: null });
    },
  );

  it('has no amount when the shortcut sent none', () => {
    expect(parser.parse({ merchant: 'X' })).toEqual({ merchant: 'X', amountNok: null });
  });

  it('takes the first value of a repeated parameter and caps the merchant name', () => {
    expect(parser.parse({ merchant: ['A', 'B'], amount: ['10', '20'] })).toEqual({
      merchant: 'A',
      amountNok: 10,
    });
    expect(parser.parse({ merchant: 'x'.repeat(300) })?.merchant).toHaveLength(200);
  });

  it.each([{}, { merchant: '  ' }, { merchant: [] }, { amount: '10' }])(
    'is null without a merchant name: %j',
    (params) => {
      expect(parser.parse(params)).toBeNull();
    },
  );
});
