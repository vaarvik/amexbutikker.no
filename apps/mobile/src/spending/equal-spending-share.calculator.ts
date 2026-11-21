import type { MemberShare, Purchase, SpendingMember, SpendingShares } from './spending.model';
import type { SpendingShareCalculator } from './spending.ports';

/**
 * Splits shared purchases equally between this phone and everyone who paid something. A named
 * member who never paid (a phone that left the household, a test) takes no part. Private
 * purchases count only for the one who paid. Rounded to whole kroner per member.
 */
export class EqualSpendingShareCalculator implements SpendingShareCalculator {
  public calculate(
    purchases: readonly Purchase[],
    members: readonly SpendingMember[],
    me: string,
  ): SpendingShares | null {
    const ids = [me, ...purchases.flatMap((purchase) => purchase.paidBy ?? [])].filter(
      (id, index, all) => all.indexOf(id) === index,
    );
    // A payer whose owner has not named themselves yet has no name.
    const everyone = ids.map(
      (id): SpendingMember => members.find((member) => member.id === id) ?? { id, name: '' },
    );
    if (everyone.length < 2) {
      return null;
    }
    const known = purchases.filter((purchase) => purchase.paidBy !== null);
    const sharedNok = this.sum(known.filter((purchase) => purchase.split === 'shared'));
    const shares = everyone.map((member): MemberShare => {
      const paid = known.filter((purchase) => purchase.paidBy === member.id);
      const paidSharedNok = this.sum(paid.filter((purchase) => purchase.split === 'shared'));
      return {
        member,
        paidSharedNok,
        privateNok: this.sum(paid.filter((purchase) => purchase.split === 'private')),
        balanceNok: Math.round(paidSharedNok - sharedNok / everyone.length),
      };
    });
    return {
      sharedNok,
      members: shares,
      unassignedNok: this.sum(purchases.filter((purchase) => purchase.paidBy === null)),
    };
  }

  private sum(purchases: readonly Purchase[]): number {
    return purchases.reduce((total, purchase) => total + purchase.amountNok, 0);
  }
}
