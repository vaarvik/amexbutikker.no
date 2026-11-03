import type {
  AcceptanceStatusCalculator,
  ChainReader,
  Clock,
  EvidenceReader,
  EvidenceSummarizer,
  GetPlaceDetails,
  GetPlaceDetailsInput,
  PlaceDetails,
  PlaceReader,
} from '@amexbutikker/contracts';

/**
 * The status is recalculated from evidence on every read, so decay is always current.
 * Stored snapshots serve the result lists, where reading every place's evidence would be too slow.
 */
export class GetPlaceDetailsUseCase implements GetPlaceDetails {
  public constructor(
    private readonly places: PlaceReader,
    private readonly chains: ChainReader,
    private readonly evidence: EvidenceReader,
    private readonly calculator: AcceptanceStatusCalculator,
    private readonly summarizer: EvidenceSummarizer,
    private readonly clock: Clock,
  ) {}

  public async execute(input: GetPlaceDetailsInput): Promise<PlaceDetails> {
    const place = await this.places.getById(input.placeId);
    const chainId = place.kind === 'physical' ? place.chainId : null;
    const [placeEvidence, chainEvidence, chain, chainHint] = await Promise.all([
      this.evidence.listForPlace(place.id),
      chainId === null ? Promise.resolve([]) : this.evidence.listForChain(chainId),
      chainId === null ? Promise.resolve(null) : this.chains.getById(chainId),
      chainId === null ? Promise.resolve(null) : this.chains.findHint(chainId),
    ]);
    const status = this.calculator.calculate(placeEvidence, chainEvidence, this.clock.now());
    const summary = this.summarizer.summarize(
      placeEvidence,
      chainEvidence,
      status,
      input.userId ?? null,
    );
    return { place, status, chain, chainHint, ...summary };
  }
}
