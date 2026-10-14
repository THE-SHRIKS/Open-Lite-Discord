// ─── In-memory presence tracker ──────────────────────────────────────────────
// Maps socketId → {userId, spaceIds[]}. Not persistent across restarts.

interface PresenceEntry {
  userId: string;
  spaceIds: string[];
}

export class PresenceTracker {
  private readonly sockets = new Map<string, PresenceEntry>();

  /** Register a socket as online for given spaces. */
  track(socketId: string, userId: string, spaceIds: string[]): void {
    this.sockets.set(socketId, { userId, spaceIds });
  }

  /** Remove socket and return the entry that was removed (for cleanup). */
  untrack(socketId: string): PresenceEntry | undefined {
    const entry = this.sockets.get(socketId);
    this.sockets.delete(socketId);
    return entry;
  }

  /** Get all online userIds for a given space (deduplicated). */
  getOnlineUserIds(spaceId: string): Set<string> {
    const result = new Set<string>();
    for (const entry of this.sockets.values()) {
      if (entry.spaceIds.includes(spaceId)) {
        result.add(entry.userId);
      }
    }
    return result;
  }

  /** Returns true if at least one socket belongs to the user. */
  isOnline(userId: string): boolean {
    for (const entry of this.sockets.values()) {
      if (entry.userId === userId) return true;
    }
    return false;
  }
}
