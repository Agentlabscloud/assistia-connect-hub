import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn("Supabase env vars missing");
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const N8N_TEST_META_WEBHOOK =
  (import.meta.env.VITE_N8N_TEST_META_CONNECTION_WEBHOOK as string) ||
  "https://n8n.agentlabs.cloud/webhook/asistia/test-meta-connection";

export const N8N_MANUAL_REPLY_WEBHOOK =
  (import.meta.env.VITE_N8N_MANUAL_REPLY_WEBHOOK as string) ||
  "https://n8n.agentlabs.cloud/webhook/asistia/manual-reply";

export const N8N_GET_TEMPLATES_WEBHOOK =
  (import.meta.env.VITE_N8N_GET_TEMPLATES_WEBHOOK as string) ||
  "https://n8n.agentlabs.cloud/webhook/asistia/get-templates";
