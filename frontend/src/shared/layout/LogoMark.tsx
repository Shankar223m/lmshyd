import { env } from "@/core/config/env";
import { cn } from "@/core/lib/cn";

/** Clean modern SVG graduation cap logo matching the LMS UI Kit reference */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-7 w-7 text-[#635BFF]", className)}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={`${env.appName} logo`}
    >
      <path d="M12 3L1 9L12 15L21 10.09V17H23V9L12 3Z" />
      <path d="M5 13.18V17.18C5 19.5 8.13 21.36 12 21.36C15.87 21.36 19 19.5 19 17.18V13.18L12 17L5 13.18Z" opacity="0.9" />
    </svg>
  );
}
