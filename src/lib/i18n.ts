// Spanish labels + helpers shared across customer dashboard

export function tStatus(v?: string | null): string {
  if (!v) return "—";
  const map: Record<string, string> = {
    pending: "Pendiente",
    active: "Activa",
    activa: "Activa",
    activo: "Activo",
    completed: "Completado",
    complete: "Completado",
    suspended: "Suspendida",
    connected: "Conectado",
    failed: "Fallido",
    error: "Fallido",
    open: "Abierta",
    closed: "Cerrada",
    new: "Nuevo",
    interested: "Interesado",
    hot: "Lead caliente",
    needs_human: "Requiere asesor",
    draft: "En configuración",
    configuring: "En configuración",
    in_progress: "En progreso",
    onboarding: "En configuración",
  };
  return map[v.toLowerCase()] ?? v;
}

export function tInterestLevel(v?: string | null): string {
  if (!v) return "—";
  const map: Record<string, string> = {
    high: "Alto",
    medium: "Medio",
    low: "Bajo",
  };
  return map[v.toLowerCase()] ?? v;
}

export function tLeadStatus(v?: string | null): string {
  if (!v) return "—";
  const map: Record<string, string> = {
    new: "Nuevo",
    interested: "Interesado",
    hot: "Lead caliente",
    needs_human: "Requiere asesor",
    closed: "Cerrado",
  };
  return map[v.toLowerCase()] ?? v;
}

export function tAssistantType(v?: string | null): string {
  if (!v) return "—";
  const map: Record<string, string> = {
    ventas: "Ventas",
    soporte: "Soporte",
    agenda: "Agenda",
  };
  return map[v.toLowerCase()] ?? v;
}

export function tNextAction(v?: string | null): string {
  if (!v) return "Sin acción sugerida";
  const map: Record<string, string> = {
    contact_now: "Contactar ahora",
    send_info: "Enviar información",
    handoff: "Pasar a asesor",
    handoff_human: "Pasar a asesor",
    follow_up: "Hacer seguimiento",
    wait: "Esperar respuesta",
    none: "Sin acción sugerida",
  };
  return map[v.toLowerCase()] ?? v;
}

export function tIntent(v?: string | null): string {
  if (!v) return "Sin intención detectada";
  const map: Record<string, string> = {
    info: "Solicita información",
    pricing: "Pregunta por precios",
    schedule: "Quiere agendar",
    buy: "Quiere comprar",
    complaint: "Reclamo",
    support: "Solicita soporte",
    greeting: "Saludo",
    handoff: "Quiere hablar con asesor",
  };
  const lower = v.toLowerCase();
  return map[lower] ?? v;
}

// Lead priority for sorting "hottest first"
export function leadPriority(lead_status?: string | null): number {
  switch ((lead_status || "").toLowerCase()) {
    case "hot": return 0;
    case "needs_human": return 1;
    case "interested": return 2;
    case "new": return 3;
    case "closed": return 5;
    default: return 4;
  }
}

export function interestPriority(level?: string | null): number {
  switch ((level || "").toLowerCase()) {
    case "high": return 0;
    case "medium": return 1;
    case "low": return 2;
    default: return 3;
  }
}

// E.164-style normalization for wa.me links — digits only
export function normalizePhone(phone?: string | null): string {
  if (!phone) return "";
  return phone.replace(/\D+/g, "");
}

export function waLink(phone?: string | null): string | null {
  const n = normalizePhone(phone);
  if (!n) return null;
  return `https://wa.me/${n}`;
}

// Try to extract a readable "reply" if content was stored as JSON by an older agent run.
export function extractMessageContent(content?: string | null): string {
  if (!content) return "";
  const s = content.trim();
  if (!s.startsWith("{") && !s.startsWith("[")) return content;
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.reply === "string") return parsed.reply;
      if (typeof parsed.message === "string") return parsed.message;
      if (typeof parsed.text === "string") return parsed.text;
      if (parsed.content && typeof parsed.content === "string") return parsed.content;
    }
  } catch {
    // fall through
  }
  return content;
}
