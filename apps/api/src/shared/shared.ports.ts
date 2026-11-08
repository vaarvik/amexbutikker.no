import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Kysely } from 'kysely';
import type {
  ChainHint,
  ChainHintDto,
  MatchPaymentOutput,
  MatchPaymentResponseDto,
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
  TransactionalPorts,
  UserId,
} from '@amexbutikker/contracts';
import type { ConstraintErrors, Database, HttpErrorResponse } from './shared.model.js';

/** One resource's routes. */
export interface HttpController {
  register(app: FastifyInstance): void;
}

/** Identifies the device behind a request. */
export interface RequestAuthenticator {
  /** @throws UnauthenticatedError when no valid token is sent. */
  requireUser(request: FastifyRequest): Promise<UserId>;
  /**
   * @returns null when no token is sent.
   * @throws UnauthenticatedError when a token is sent but is invalid.
   */
  optionalUser(request: FastifyRequest): Promise<UserId | null>;
}

/** Turns use case output into wire DTOs. */
export interface HttpDtoMapper {
  place(place: Place): PlaceDto;
  status(status: PlaceStatus): PlaceStatusDto;
  chainHint(hint: ChainHint): ChainHintDto;
  placeList(output: PlaceListOutput): PlaceListResponseDto;
  placeDetails(details: PlaceDetails): PlaceDetailsResponseDto;
  statusChange(output: StatusChangeOutput): StatusChangeResponseDto;
  sharedMatch(output: MatchSharedPlaceOutput): MatchSharedResponseDto;
  paymentMatch(output: MatchPaymentOutput): MatchPaymentResponseDto;
}

/** Maps any thrown value to an HTTP response. */
export interface HttpErrorMapper {
  toResponse(error: unknown): HttpErrorResponse;
}

/** Builds and runs the HTTP API. */
export interface HttpServer {
  /** The configured app, ready for `inject` in tests. Built once. */
  app(): FastifyInstance;
  listen(host: string, port: number): Promise<string>;
  close(): Promise<void>;
}

/** Turns driver errors into typed domain errors. */
export interface DatabaseErrorTranslator {
  /**
   * @returns the mapped DomainError when `error` violates one of the given constraints,
   *   otherwise `error` itself (wrapped in an Error if it is not one).
   */
  translate(error: unknown, constraints: ConstraintErrors): Error;

  /** True for errors after which the whole transaction may be retried (serialisation, deadlock). */
  isRetryable(error: unknown): boolean;
}

/** Builds the transactional ports over a transaction. Supplied by the composition root. */
export type PgPortsFactory = (executor: Kysely<Database>) => TransactionalPorts;
