import type {
  AcceptanceStatusCalculator,
  ChainHintCalculator,
  Clock,
  PlaceId,
  PlaceStatusRefresher,
  StatusChangeOutput,
  TransactionalPorts,
} from '@amexbutikker/contracts';

export class CalculatingPlaceStatusRefresher implements PlaceStatusRefresher {
  public constructor(
    private readonly calculator: AcceptanceStatusCalculator,
    private readonly hintCalculator: ChainHintCalculator,
    private readonly clock: Clock,
  ) {}

  public async refresh(ports: TransactionalPorts, placeId: PlaceId): Promise<StatusChangeOutput> {
    const now = this.clock.now();
    const place = await ports.places.getById(placeId);
    const chainId = place.kind === 'physical' ? place.chainId : null;
    const placeEvidence = await ports.evidence.listForPlace(placeId);
    const chainEvidence = chainId === null ? [] : await ports.evidence.listForChain(chainId);

    const status = this.calculator.calculate(placeEvidence, chainEvidence, now);
    await ports.statuses.save({ placeId, status, calculatedAt: now });
    if (chainId === null) {
      return { status, chainHint: null };
    }

    const snapshots = await ports.statuses.listForChain(chainId);
    const chainHint = this.hintCalculator.calculate(
      chainId,
      snapshots.map((snapshot) => snapshot.status),
      now,
    );
    await ports.chains.saveHint(chainHint);
    return { status, chainHint };
  }
}
