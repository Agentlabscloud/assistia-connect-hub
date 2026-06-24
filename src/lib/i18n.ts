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

// "19 jun 2026, 5:22 p. m." — no seconds
export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("es", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return d.toLocaleString("es");
  }
}

export function isWithin24h(value?: string | null): boolean {
  if (!value) return false;
  const d = new Date(value).getTime();
  if (isNaN(d)) return false;
  return Date.now() - d < 24 * 60 * 60 * 1000;
}

export function currentPeriodMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// "Junio de 2026"
export function formatPeriodMonth(period?: string | null): string {
  const p = period || currentPeriodMonth();
  const [y, m] = p.split("-").map(Number);
  if (!y || !m) return p;
  try {
    const label = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" }).format(
      new Date(y, m - 1, 1),
    );
    return label.charAt(0).toLocaleUpperCase("es") + label.slice(1);
  } catch {
    return p;
  }
}

// Dynamic status labels per assistant_type. Internal values stay new/interested/hot.
type StatusKey = "new" | "interested" | "hot";
const STATUS_LABELS: Record<string, Record<StatusKey, string>> = {
  ventas:  { new: "Nuevos",            interested: "Interesados",             hot: "Leads calientes" },
  agenda:  { new: "Nuevas solicitudes", interested: "En coordinación",        hot: "Por agendar" },
  soporte: { new: "Nuevos casos",       interested: "En seguimiento",         hot: "Prioritarios" },
  default: { new: "Nuevos",            interested: "En seguimiento",          hot: "Prioritarios" },
};
const STATUS_COL_HEADER: Record<string, string> = {
  ventas: "Estado comercial",
  agenda: "Estado de agenda",
  soporte: "Estado del caso",
  default: "Estado",
};
const EMPTY_BY_TYPE: Record<string, Record<StatusKey | "all", string>> = {
  ventas:  {
    new: "No hay clientes nuevos con este filtro.",
    interested: "No hay clientes interesados con este filtro.",
    hot: "No hay leads calientes con este filtro.",
    all: "Aún no hay clientes para mostrar.",
  },
  agenda:  {
    new: "No hay nuevas solicitudes con este filtro.",
    interested: "No hay solicitudes en coordinación con este filtro.",
    hot: "No hay solicitudes pendientes por agendar con este filtro.",
    all: "Aún no hay clientes para mostrar.",
  },
  soporte: {
    new: "No hay casos nuevos con este filtro.",
    interested: "No hay casos en seguimiento con este filtro.",
    hot: "No hay casos prioritarios con este filtro.",
    all: "Aún no hay clientes para mostrar.",
  },
  default: {
    new: "No hay clientes nuevos con este filtro.",
    interested: "No hay clientes en seguimiento con este filtro.",
    hot: "No hay clientes prioritarios con este filtro.",
    all: "Aún no hay clientes para mostrar.",
  },
};

function bucket(t?: string | null) {
  const k = (t || "").toLowerCase();
  return k === "ventas" || k === "agenda" || k === "soporte" ? k : "default";
}

export function statusLabelByType(status: string, assistantType?: string | null): string {
  const k = status.toLowerCase() as StatusKey;
  const map = STATUS_LABELS[bucket(assistantType)];
  return map[k] ?? status;
}
export function statusColumnHeader(assistantType?: string | null) {
  return STATUS_COL_HEADER[bucket(assistantType)];
}
export function emptyStateText(
  assistantType: string | null | undefined,
  filter: "all" | StatusKey,
): string {
  return EMPTY_BY_TYPE[bucket(assistantType)][filter];
}

// Build a list of ISO date keys for the last N days (inclusive, local TZ)
export function lastNDays(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(d);
    out.push({ key, label });
  }
  return out;
}

export function dayKey(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
