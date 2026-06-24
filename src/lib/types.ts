export interface Profile {
  id: string;
  company_id: string;
  full_name?: string | null;
  role?: string | null;
}

export interface Company {
  id: string;
  name: string | null;
  legal_name?: string | null;
  email: string | null;
  phone?: string | null;
  country: string | null;
  city?: string | null;
  address?: string | null;
  tax_id?: string | null;
  industry?: string | null;
  status?: string | null;
  onboarding_status?: string | null;
}

export type AssistantType = "ventas" | "soporte" | "agenda" | string;

export interface Assistant {
  id: string;
  company_id: string;
  name: string | null;
  product_name: string | null;
  business_description: string | null;
  system_prompt: string | null;
  tone: string | null;
  fallback_message: string | null;
  handoff_phone: string | null;
  assistant_type?: AssistantType | null;
  booking_url?: string | null;
  optimization_ends_at?: string | null;
  status?: string | null;
}

export interface WhatsappAccount {
  id: string;
  company_id: string;
  assistant_id?: string | null;
  phone_number_id: string | null;
  whatsapp_business_account_id: string | null;
  meta_business_id?: string | null;
  phone_number?: string | null;
  status: "connected" | "pending" | "failed" | string | null;
  webhook_status?: string | null;
  verified_name?: string | null;
  display_phone_number?: string | null;
  quality_rating?: string | null;
  verify_token?: string | null;
  connection_error?: string | null;
  connection_step?: string | null;
  connection_error_code?: string | null;
  connection_error_details?: string | null;
}

export interface WhatsappTemplateComponent {
  type?: string;
  format?: string;
  text?: string;
}
export interface WhatsappTemplate {
  name: string;
  language: string;
  status: string;
  category?: string | null;
  components?: WhatsappTemplateComponent[] | null;
}

export const SUPPORT_WHATSAPP_URL =
  "https://wa.me/573112490009?text=Hola%20AgentLabs%2C%20necesito%20soporte%20con%20mi%20cuenta%20de%20Assistia.";

export interface UsageCounter {
  id: string;
  company_id: string;
  period_month?: string | null;
  messages_used: number | null;
  messages_limit: number | null;
}

export interface Contact {
  id: string;
  company_id: string;
  whatsapp_account_id?: string | null;
  name: string | null;
  phone: string | null;
  city: string | null;
  source: string | null;
  interest: string | null;
  status: string | null;
  last_interaction_at: string | null;
  created_at: string | null;
  last_intent?: string | null;
  memory_summary?: string | null;
  last_interest_at?: string | null;
}

export interface Conversation {
  id: string;
  company_id: string;
  assistant_id?: string | null;
  whatsapp_account_id?: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: string | null;
  lead_status: string | null;
  interest_level: string | null;
  notes?: string | null;
  last_message_at: string | null;
  created_at?: string | null;
  summary?: string | null;
  last_intent?: string | null;
  next_action?: string | null;
  context_updated_at?: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  company_id: string;
  direction: "inbound" | "outbound" | string;
  message_type?: string | null;
  content: string | null;
  created_at: string | null;
}

export interface Subscription {
  id: string;
  company_id: string;
  plan_name?: string | null;
  setup_fee_cop?: number | null;
  monthly_fee_cop?: number | null;
  included_messages?: number | null;
  billing_status?: string | null;
  trial_ends_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
}

export const SUPPORT_EMAIL = "admin@agentlabs.cloud";
export const DEFAULT_MESSAGE_LIMIT = 5000;
