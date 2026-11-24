import { useEffect, useState } from "react";
import { useFormContext, type FieldValues } from "react-hook-form";

import { cn } from "@/core/lib/cn";
import type { UserFormOptions } from "@/modules/user-management/common/permissions/types";
import { useLazyGenerateUserPasswordQuery } from "@/modules/user-management/users/api/usersApi";
import { useFieldError } from "@/shared/form/useFieldError";
import { Field, Icon } from "@/shared/ui";
import { controlClass } from "@/shared/ui/controlStyles";

/**
 * One password box with two icons inside it: show / hide, and a new random password. Adding someone: a random password is
 * already filled in, so nothing has to be typed. Editing: the box starts empty (the current password is never shown) and a
 * new one is set only when it is filled. Either way the person must change it at first sign-in.
 */
export function PasswordChoice({ options, editing = false, name = "account.password", minLength: minimum }: {
  options?: UserFormOptions;
  editing?: boolean;
  /** The form field that holds the password: a person's account by default, or an institution's shared login. */
  name?: string;
  minLength?: number;
}) {
  const { register, setValue, getValues } = useFormContext<FieldValues>();
  const error = useFieldError<FieldValues>(name);
  const isAccount = name === "account.password";
  const [visible, setVisible] = useState(false);
  const minLength = minimum ?? options?.initial_password.min_length ?? 8;
  const [generate, { isFetching }] = useLazyGenerateUserPasswordQuery();

  // Adding: the server makes a random password, filled in once and sent as the initial password.
  useEffect(() => {
    if (editing) return;
    if (isAccount) {
      setValue("account.set_password", true);
      setValue("account.generate_password", false);
    }
    if (getValues(name)) return;
    void generate(undefined, false).unwrap().then((password) => {
      if (!getValues(name)) setValue(name, password);
    }).catch(() => undefined); // the box stays empty and can be filled by hand or with the rotate icon
  }, [editing, generate, getValues, setValue, name, isAccount]);

  const regenerate = () => {
    void generate(undefined, false).unwrap().then((password) => {
      setValue(name, password, { shouldDirty: true, shouldValidate: true });
      setVisible(true); // show what was just made
    }).catch(() => undefined);
  };

  const iconButton = "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

  return (
    <div>
      <Field label={editing ? "New password" : "Password"} error={error} required={!editing}>
        {(props) => (
          <div className="relative">
            <input
              {...props}
              {...register(name, {
                validate: (value) => {
                  const text = typeof value === "string" ? value : "";
                  if (!text) return editing ? true : "Enter a password";
                  return text.length >= minLength || `At least ${minLength} characters`;
                },
              })}
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              placeholder={editing ? "Leave empty to keep the current password" : undefined}
              maxLength={128}
              className={controlClass(Boolean(error), cn("h-11 pr-[4.75rem]", visible && "font-mono tracking-wide"))}
            />
            <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
              <button type="button" onClick={() => setVisible((value) => !value)} className={iconButton} aria-label={visible ? "Hide password" : "Show password"} title={visible ? "Hide" : "Show"}>
                <Icon name={visible ? "eyeOff" : "eye"} size={16} />
              </button>
              <button type="button" onClick={regenerate} className={iconButton} aria-label="Generate a new password" title="Generate a new password">
                <Icon name="refreshCw" size={16} className={isFetching ? "animate-spin" : undefined} />
              </button>
            </div>
          </div>
        )}
      </Field>
    </div>
  );
}
