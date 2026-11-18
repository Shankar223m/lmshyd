import { useEffect, useRef, useState } from "react";

import { fetchUserPhoto, photoProblem } from "@/modules/user-management/users/api/userPhoto";
import { Icon } from "@/shared/ui";

export interface PhotoChoice {
  /** A new picture to save with the person. */
  file: File | null;
  /** The person's current picture is to be removed. */
  removed: boolean;
}

/**
 * The profile photo at the top of a person's form: a round picture with a camera button on it. Adding someone: choose a
 * picture to save together with the person. Editing: their current picture is shown; change it or remove it.
 */
export function ProfilePhotoField({ userId, name, value, onChange }: {
  userId: string | null;
  name: string;
  value: PhotoChoice;
  onChange: (next: PhotoChoice) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    let made: string | null = null;
    void fetchUserPhoto(userId).then((photo) => {
      made = photo;
      if (live) setCurrent(photo);
      else if (photo) URL.revokeObjectURL(photo);
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [userId]);

  useEffect(() => {
    if (!value.file) {
      setChosen(null);
      return;
    }
    const made = URL.createObjectURL(value.file);
    setChosen(made);
    return () => URL.revokeObjectURL(made);
  }, [value.file]);

  const shown = chosen ?? (value.removed ? null : current);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

  const pick = (file: File | undefined) => {
    if (!file) return;
    const why = photoProblem(file);
    setProblem(why);
    if (!why) onChange({ file, removed: false });
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[72px] w-[72px] shrink-0">
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-xl font-semibold text-slate-500">
          {shown ? <img src={shown} alt="" className="h-full w-full object-cover" /> : initials || <Icon name="user" size={28} />}
        </div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-brand-700 text-white shadow-card transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          aria-label={shown ? "Change profile photo" : "Add profile photo"}
        >
          <Icon name="camera" size={15} />
        </button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onChange={(event) => { pick(event.target.files?.[0]); event.target.value = ""; }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700">Profile photo</p>
        {shown && (
          <button type="button" onClick={() => { setProblem(null); onChange({ file: null, removed: Boolean(userId) }); }} className="text-[13px] font-medium text-slate-500 underline-offset-4 hover:text-red-600 hover:underline">
            Remove
          </button>
        )}
        {problem && <p role="alert" className="text-[13px] text-red-600">{problem}</p>}
      </div>
    </div>
  );
}
