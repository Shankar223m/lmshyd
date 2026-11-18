import { store } from "@/app/store";
import { env } from "@/core/config/env";

/** A person's profile photo: the picture itself is the request body (PNG, JPEG or WebP); the server checks and keeps it. */
const url = (userId: string) => `${env.apiBaseUrl}/users/${userId}/avatar`;
const auth = (): Record<string, string> => {
  const token = store.getState().auth.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/** A plain-words reason a chosen file cannot be used, or null. The server checks again. */
export function photoProblem(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return "Use a PNG, JPG or WebP picture.";
  if (file.size > PHOTO_MAX_BYTES) return "The picture is too large. Use one under 2 MB.";
  return null;
}

async function failure(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { message?: string };
    return new Error(body.message ?? "The photo could not be saved.");
  } catch {
    return new Error("The photo could not be saved.");
  }
}

export async function uploadUserPhoto(userId: string, file: File): Promise<void> {
  const response = await fetch(url(userId), { method: "PUT", headers: { ...auth(), "Content-Type": file.type }, body: file });
  if (!response.ok) throw await failure(response);
}

export async function removeUserPhoto(userId: string): Promise<void> {
  const response = await fetch(url(userId), { method: "DELETE", headers: auth() });
  if (!response.ok && response.status !== 404) throw await failure(response);
}

/** The photo as an object URL to show, or null when the person has none (the picture needs the sign-in header, so it is fetched). */
export async function fetchUserPhoto(userId: string): Promise<string | null> {
  const response = await fetch(url(userId), { headers: auth() });
  if (!response.ok) return null;
  return URL.createObjectURL(await response.blob());
}
