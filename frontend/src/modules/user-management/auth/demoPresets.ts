import accounts from "@/config/demo-accounts.json";

export type DemoPreset = {
  role: string;
  label: string;
  email: string;
  username: string;
  password: string;
  notes?: string;
};

/** Login picker options — source: frontend/src/config/demo-accounts.json (see docs/DEMO_CREDENTIALS.md). */
export const DEMO_PRESETS: DemoPreset[] = accounts as DemoPreset[];
