import type { PurchaseSplit, SpendingMember } from '../spending/spending.model';

export const SPLIT_OPTIONS: readonly { readonly value: PurchaseSplit; readonly label: string }[] = [
  { value: 'shared', label: 'Felles' },
  { value: 'private', label: 'Privat' },
];

/** "Meg" for this phone, the member's name, or a stand-in for a phone without one. */
export function memberLabel(
  id: string | null,
  members: readonly SpendingMember[],
  me: string,
): string {
  if (id === null) {
    return 'Ukjent';
  }
  if (id === me) {
    return 'Meg';
  }
  const name = members.find((member) => member.id === id)?.name ?? '';
  return name === '' ? 'Annen telefon' : name;
}
