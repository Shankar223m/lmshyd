import { useEffect, useState } from "react";

import { fetchUserPhoto } from "@/modules/user-management/users/api/userPhoto";
import { Avatar } from "@/shared/ui";

const cache = new Map<string, string | null>();

/** A person's profile photo in a list row, or their initials when they have none. Fetched once per photo version. */
export function PersonAvatar({ userId, name, version }: { userId: string; name: string; version?: number }) {
  const key = `${userId}:${version ?? 0}`;
  const [photo, setPhoto] = useState<string | null>(cache.get(key) ?? null);

  useEffect(() => {
    if (!version) {
      setPhoto(null);
      return;
    }
    if (cache.has(key)) {
      setPhoto(cache.get(key) ?? null);
      return;
    }
    let live = true;
    void fetchUserPhoto(userId).then((url) => {
      cache.set(key, url);
      if (live) setPhoto(url);
    });
    return () => {
      live = false;
    };
  }, [key, userId, version]);

  if (!photo) return <Avatar name={name} size="sm" />;
  return <img src={photo} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />;
}
