export type AnimeApiErrorCode =
  | "offline"
  | "network"
  | "rate_limited"
  | "http"
  | "graphql"
  | "invalid_response"
  | "unknown";

export class AnimeApiError extends Error {
  constructor(
    public readonly code: AnimeApiErrorCode,
    message: string,
    public readonly options: { status?: number; retryAfterSeconds?: number; cause?: unknown } = {}
  ) {
    super(message);
    this.name = "AnimeApiError";
  }
}

export function normalizeApiError(
  error: unknown,
  context: { offline?: boolean } = {}
): AnimeApiError {
  if (error instanceof AnimeApiError) return error;
  if (context.offline) {
    return new AnimeApiError("offline", "You appear to be offline", { cause: error });
  }
  if (error instanceof TypeError) {
    return new AnimeApiError("network", "Unable to reach AniList", { cause: error });
  }
  if (error instanceof Error) {
    return new AnimeApiError("unknown", error.message, { cause: error });
  }
  return new AnimeApiError("unknown", "An unknown AniList error occurred", { cause: error });
}

export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) return undefined;
  return Math.max(0, Math.ceil((retryAt - now) / 1000));
}
