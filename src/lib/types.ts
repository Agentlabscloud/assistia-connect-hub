export interface Profile {
  id: string;
  company_id: string;
  full_name?: string | null;
  role?: string | null;
}

export interface Company {
  id: string;
  name: string | null;
  email: string | null;
  country: string | null;
  status?: string | null;
  onboarding_status?: string | null;
}

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
  status?: string | null;
}

export interface WhatsappAccount {
  id: string;
  company_id: string;
  phone_number_id: string | null;
  whatsapp_business_account_id: string | null;
  phone_number?: string | null;
  verified_name?: string | null;
  quality_rating?: string | null;
  status: "connected" | "pending" | "failed" | string | null;
  connection_error?: string | null;
}

export interface UsageCounter {
  id: string;
  company_id: string;
  period_start?: string | null;
  period_end?: string | null;
  messages_used: number | null;
  messages_limit: number | null;
  tokens_used: number | null;
  tokens_limit: number | null;
  estimated_ai_cost?: number | null;
}

export interface Contact {
  id: string;
  company_id: string;
  name: string | null;
  phone: string | null;
  city: string | null;
  source: string | null;
  interest: string | null;
  status: string | null;
  last_interaction_at: string | null;
  created_at: string | null;
}

export interface Conversation {
  id: string;
  company_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  status: string | null;
  lead_status: string | null;
  interest_level: string | null;
  last_message_at: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  company_id: string;
  direction: "inbound" | "outbound" | string;
  content: string | null;
  created_at: string | null;
}

export interface Subscription {
  id: string;
  company_id: string;
  plan_name?: string | null;
  status?: string | null;
  started_at?: string | null;
  ends_at?: string | null;
  messages_limit?: number | null;
}
