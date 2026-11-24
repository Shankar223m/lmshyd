import { env } from "@/core/config/env";

/** Authenticated stream URL for course card / hero thumbnails (images uploaded via media-service). */
export function courseThumbnailSrc(mediaId: string | number | null | undefined): string | null {
  if (mediaId == null || mediaId === "") return null;
  return `${env.apiBaseUrl}/media/stream/${String(mediaId)}`;
}