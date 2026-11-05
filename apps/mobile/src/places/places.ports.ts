import type {
  CreatePlaceRequestDto,
  CreatePlaceResponseDto,
  MatchSharedResponseDto,
  NearbyPlacesQueryDto,
  PlaceDetailsResponseDto,
  PlaceId,
  PlaceListResponseDto,
  SearchPlacesQueryDto,
  StatusChangeResponseDto,
  SubmitReportRequestDto,
} from '@amexbutikker/contracts';
import type { NearbySnapshot, NearbyState } from './places.model';

/** The places endpoints of the API. Every response is validated against its contract schema. */
export interface PlacesApiClient {
  search(query: SearchPlacesQueryDto): Promise<PlaceListResponseDto>;
  listNearby(query: NearbyPlacesQueryDto): Promise<PlaceListResponseDto>;
  /** Includes `myReport` once the device has registered. */
  getDetails(placeId: PlaceId): Promise<PlaceDetailsResponseDto>;
  create(input: CreatePlaceRequestDto): Promise<CreatePlaceResponseDto>;
  submitReport(placeId: PlaceId, input: SubmitReportRequestDto): Promise<StatusChangeResponseDto>;
  removeMyReport(placeId: PlaceId): Promise<StatusChangeResponseDto>;
  /** Matches text shared from a maps app to known places. The API never calls Google. */
  matchShared(text: string): Promise<MatchSharedResponseDto>;
}

/** Keeps the last nearby list across app starts. */
export interface NearbyCache {
  /** null when nothing is stored or the stored value is unreadable. */
  find(): Promise<NearbySnapshot | null>;
  save(snapshot: NearbySnapshot): Promise<void>;
}

/** Loads the "Nær deg" list: the cached list at once, then a fresh one. */
export interface NearbyService {
  /** Calls `onState` with each state in order and resolves after the last one. */
  load(onState: (state: NearbyState) => void): Promise<void>;
}
