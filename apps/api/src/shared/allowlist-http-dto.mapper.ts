import type {
  ChainHint,
  ChainHintDto,
  MatchCandidateDto,
  MatchSharedPlaceOutput,
  MatchSharedResponseDto,
  Place,
  PlaceDetails,
  PlaceDetailsResponseDto,
  PlaceDto,
  PlaceListOutput,
  PlaceListResponseDto,
  PlaceStatus,
  PlaceStatusDto,
  StatusChangeOutput,
  StatusChangeResponseDto,
} from '@amexbutikker/contracts';
import type { HttpDtoMapper } from './shared.ports.js';

/**
 * Copies an explicit list of fields into each DTO, so a field added to the model never reaches
 * the wire by accident. Dates become ISO strings.
 */
export class AllowlistHttpDtoMapper implements HttpDtoMapper {
  public place(place: Place): PlaceDto {
    const base = { id: place.id, name: place.name, category: place.category };
    return place.kind === 'online'
      ? { kind: 'online', ...base, website: place.website }
      : {
          kind: 'physical',
          ...base,
          website: place.website,
          chainId: place.chainId,
          address: place.address,
          location: place.location,
        };
  }

  public status(status: PlaceStatus): PlaceStatusDto {
    return {
      status: status.status,
      confidence: status.confidence,
      basis: status.basis,
      verified: status.verified,
      lastEvidenceAt: status.lastEvidenceAt?.toISOString() ?? null,
    };
  }

  public chainHint(hint: ChainHint): ChainHintDto {
    return {
      chainId: hint.chainId,
      acceptedCount: hint.acceptedCount,
      totalWithEvidence: hint.totalWithEvidence,
    };
  }

  public placeList(output: PlaceListOutput): PlaceListResponseDto {
    return {
      results: output.results.map((summary) => ({
        place: this.place(summary.place),
        status: this.status(summary.status),
        distanceM: summary.distanceM,
      })),
    };
  }

  public placeDetails(details: PlaceDetails): PlaceDetailsResponseDto {
    return {
      place: this.place(details.place),
      status: this.status(details.status),
      basis: { ...details.basis, observedAt: details.basis.observedAt?.toISOString() ?? null },
      chain: details.chain === null ? null : { id: details.chain.id, name: details.chain.name },
      chainHint: details.chainHint === null ? null : this.chainHint(details.chainHint),
      latestNotes: details.latestNotes.map((note) => ({
        ...note,
        observedAt: note.observedAt.toISOString(),
      })),
      myReport: details.myReport,
    };
  }

  public statusChange(output: StatusChangeOutput): StatusChangeResponseDto {
    return {
      status: this.status(output.status),
      chainHint: output.chainHint === null ? null : this.chainHint(output.chainHint),
    };
  }

  public sharedMatch(output: MatchSharedPlaceOutput): MatchSharedResponseDto {
    const { provider, name, street, postcode, city } = output.parsed;
    return {
      parsed: { provider, name, street, postcode, city },
      candidates: output.candidates.map((candidate): MatchCandidateDto => ({
        place: this.place(candidate.place),
        status: this.status(candidate.status),
        score: candidate.score,
        reasons: candidate.reasons,
      })),
      decision: output.decision,
    };
  }
}
