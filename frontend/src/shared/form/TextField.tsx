import { useFormContext, type FieldValues } from "react-hook-form";

import { Field, Icon, Input, type IconName } from "@/shared/ui";
import { BaseFieldProps, useFieldError } from "./useFieldError";

export function TextField<T extends FieldValues>({
  name,
  label,
  hint,
  required,
  className,
  rules,
  disabled,
  type = "text",
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
  icon,
}: BaseFieldProps<T> & {
  type?: "text" | "email" | "tel" | "url" | "date" | "month" | "number";
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric" | "url";
  maxLength?: number;
  icon?: IconName;
}) {
  const { register } = useFormContext<T>();
  const error = useFieldError(name);
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(props) => (
        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Icon name={icon} size={16} />
            </span>
          )}
          <Input
            {...props}
            {...register(name, rules)}
            type={type}
            invalid={Boolean(error)}
            placeholder={placeholder}
            autoComplete={autoComplete}
            inputMode={inputMode}
            maxLength={maxLength}
            disabled={disabled}
            className={icon ? "pl-9" : undefined}
          />
        </div>
      )}
    </Field>
  );
}
