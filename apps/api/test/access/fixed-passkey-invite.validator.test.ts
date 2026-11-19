import { ValidationError } from '@amexbutikker/contracts';
import { describe, expect, it } from 'vitest';
import { FixedPasskeyInviteValidator } from '../../src/access/fixed-passkey-invite.validator.js';

describe('FixedPasskeyInviteValidator', () => {
  it('accepts the code, ignoring surrounding spaces', () => {
    expect(() => {
      new FixedPasskeyInviteValidator('blue-otter-42').validate(' blue-otter-42 ');
    }).not.toThrow();
  });

  it('refuses another code', () => {
    expect(() => {
      new FixedPasskeyInviteValidator('blue-otter-42').validate('blue-otter-43');
    }).toThrow('Wrong invite code');
  });

  it('refuses everything without a code', () => {
    expect(() => {
      new FixedPasskeyInviteValidator(null).validate('anything');
    }).toThrow(ValidationError);
  });
});
