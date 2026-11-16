import type { MemberShare, Purchase, SpendingMember, SpendingShares } from './spending.model';
import type { SpendingShareCalculator } from './spending.ports';

/**
 * Splits shared purchases equally between everyone who is part of the household: the named
 * members and anyone else who paid. Private purchases count only for the one who paid. Rounded to
 * whole kroner per member.
 */
export class EqualSpendingShareCalculator implements SpendingShareCalculator {
  public calculate(
    purchases: readonly Purchase[],
    members: readonly SpendingMember[],
  ): SpendingShares | null {
    const everyone = [...members];
    for (const purchase of purchases) {
      if (purchase.paidBy !== null && !everyone.some((member) => member.id === purchase.paidBy)) {
        // Paid on a phone whose owner has not named themselves yet.
        everyone.push({ id: purchase.paidBy, name: '' });
      }
    }
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
