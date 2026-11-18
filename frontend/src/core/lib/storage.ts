import type { AuthUser } from "@/modules/user-management/auth/types";
import type { Permissions } from "@/modules/user-management/common/permissions/types";
import type { Id } from "@/core/api/types";

/**
 * Only a copy of the signed-in user survives a reload, so the app can render immediately. Tokens are never
 * stored here: the access token lives in memory and the refresh token in an httpOnly cookie the page cannot read.
 */
const SESSION_KEY = "lms.session";
const PERMISSIONS_KEY = "lms.permissions";

export interface PersistedSession {
  user: AuthUser;
  token?: string;
}

export const storage = {
  readSession(): PersistedSession | null {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as PersistedSession) : null;
    } catch {
      return null;
    }
  },
  writeSession(session: PersistedSession | null): void {
    try {
      if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else window.localStorage.removeItem(SESSION_KEY);
    } catch {
      /* storage unavailable (private mode): the session simply won't survive a reload */
    }
  },
  readPermissions(userId: Id | undefined): Permissions | null {
    if (!userId) return null;
    try {
      const raw = window.localStorage.getItem(PERMISSIONS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { userId: Id; permissions: Permissions };
      return parsed.userId === userId ? parsed.permissions : null;
    } catch {
      return null;
    }
  },
  writePermissions(userId: Id, permissions: Permissions): void {
    try {
      window.localStorage.setItem(PERMISSIONS_KEY, JSON.stringify({ userId, permissions }));
    } catch {
      /* ignore */
    }
  },
  clearPermissions(): void {
    try {
      window.localStorage.removeItem(PERMISSIONS_KEY);
    } catch {
      /* ignore */
    }
  },
};

export interface ProctoringSessionRef {
  sessionId: string;
  heartbeatIntervalSeconds: number;
  snapshotIntervalSeconds: number;
  screenShare?: boolean;
  audioIntervalSeconds?: number;
  audioClipSeconds?: number;
  /** strict: record the whole attempt in standalone pieces of this many seconds (0 / absent = not recorded) */
  videoChunkSeconds?: number;
}

/**
 * The proctoring session an attempt is bound to, so the exam player (assessments) can keep sending
 * heartbeats and events after a refresh without a lookup endpoint (proctoring-service has none for
 * "my active session"). Tab-scoped: a refresh in the same tab survives, a new tab does not.
 */
export const proctoringSessionStorage = {
  read(attemptId: string): ProctoringSessionRef | null {
    try {
      const raw = window.sessionStorage.getItem(`lms.proctoring.${attemptId}`);
      return raw ? (JSON.parse(raw) as ProctoringSessionRef) : null;
    } catch {
      return null;
    }
  },
  write(attemptId: string, ref: ProctoringSessionRef): void {
    try {
      window.sessionStorage.setItem(`lms.proctoring.${attemptId}`, JSON.stringify(ref));
    } catch {
      /* storage unavailable: the exam still runs, just without client-side proctoring reporting */
    }
  },
};

export interface TutorAttachment {
  code: string;
  language: string;
  /** Where it came from, e.g. the problem's title, shown on the chip. */
  title: string;
}

/**
 * Code a student chose to show the AI tutor ("Ask the AI tutor" on a coding screen). Tab-scoped and kept until they
 * remove it from the chat, so the tutor sees what they are working on with each question.
 */
export const tutorAttachmentStorage = {
  read(): TutorAttachment | null {
    try {
      const raw = window.sessionStorage.getItem("lms.tutor.attachment");
      return raw ? (JSON.parse(raw) as TutorAttachment) : null;
    } catch {
      return null;
    }
  },
  write(attachment: TutorAttachment): void {
    try {
      window.sessionStorage.setItem("lms.tutor.attachment", JSON.stringify({ ...attachment, code: attachment.code.slice(0, 8000) }));
    } catch {
      /* storage unavailable: the tutor simply won't see the code */
    }
  },
  clear(): void {
    try {
      window.sessionStorage.removeItem("lms.tutor.attachment");
    } catch {
      /* nothing to clear */
    }
  },
};
