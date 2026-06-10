
# Plan: Frontend MVP AgentLabs Cloud (Assistia)

Solo construyo frontend sobre tu backend ya existente. **No toco** Supabase (tablas, RLS, triggers, funciones), ni n8n, ni endpoints. Sin migraciones, sin SQL, sin service_role.

## 1. Setup base

- Instalar `@supabase/supabase-js`.
- Crear `.env` con:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_N8N_TEST_META_CONNECTION_WEBHOOK`
- `src/lib/supabase.ts` → cliente único con anon key (persistSession, autoRefreshToken).
- `src/lib/types.ts` → tipos TS manuales para las tablas existentes (sin generar).
- Branding en `src/styles.css`: tokens oklch para `#003153`, `#00444F`, `#94C130`, `#F9FBF2`, neutros, estados success/warning/error suaves. Tipografía sans (Inter vía `<link>` en `__root.tsx`). Bordes redondeados suaves, sombras ligeras.
- Logo: esperar a que subas `agentlabs-cloud-logo.png`. Mientras tanto, componente `<Logo />` con fallback de wordmark "AgentLabs Cloud". Cuando subas el asset, se reemplaza importándolo en el componente. Sin redibujar logo.

## 2. Auth y carga de contexto

- `AuthProvider` (`src/lib/auth-context.tsx`): suscribe `onAuthStateChange`, expone `session`, `user`, `signOut`.
- `CompanyProvider` (`src/lib/company-context.tsx`): tras login, carga `profiles` por `auth.uid()` → obtiene `company_id`. Expone `profile`, `companyId`, `loading`, `refetch`.
  - Si profile no existe aún (justo después de registro), reintenta con backoff (5 intentos cada 1.5s) y muestra "Estamos preparando tu cuenta…".
- Toda query a Supabase usa `.eq('company_id', companyId)`.

## 3. Rutas (TanStack Router, archivos planos en `src/routes/`)

Públicas:
- `login.tsx` → `/login`
- `register.tsx` → `/register`

Privadas bajo layout pathless `_app.tsx` (gate con sesión + companyId; sin sesión → `/login`):
- `_app.dashboard.tsx` → `/dashboard`
- `_app.assistant.tsx` → `/assistant`
- `_app.whatsapp.tsx` → `/whatsapp`
- `_app.clients.tsx` → `/clients`
- `_app.conversations.tsx` → `/conversations`
- `_app.usage.tsx` → `/usage`
- `_app.billing.tsx` → `/billing`
- `_app.notifications.tsx` → `/notifications`
- `_app.settings.tsx` → `/settings`
- `index.tsx` redirige a `/dashboard` si hay sesión, a `/login` si no.

## 4. Layout privado

`AppLayout` con:
- Sidebar fijo desktop / drawer móvil (`#003153` de fondo, ítems blancos, activo con acento `#94C130`). Logo arriba. Menú: Dashboard, Assistia, WhatsApp, Clientes, Conversaciones, Uso mensual, Billing, Notificaciones, Configuración.
- Header superior: nombre de empresa, email del usuario, botón "Cerrar sesión".
- Contenido sobre fondo `#F9FBF2`/blanco.

## 5. Páginas (todas filtran por company_id, solo lectura salvo lo indicado)

- **Login / Register**: email+password con Supabase Auth. Logo centrado. Redirige a `/dashboard`. No crea profile/company/assistant manualmente (lo hace tu trigger).
- **Dashboard**: tarjetas `StatCard` (estado Assistia, estado WhatsApp, mensajes usados con barra, tokens usados, clientes registrados, conversaciones abiertas, plan actual, onboarding). Sección "Configura Assistia en 3 pasos" con progreso 0–3 y botones a `/assistant` y `/whatsapp`.
- **Assistia (`/assistant`)**: formulario que **actualiza solo**: `name`, `product_name`, `business_description`, `system_prompt`, `tone`, `fallback_message`, `handoff_phone`. Toasts. Textos de ayuda.
- **WhatsApp (`/whatsapp`)**: muestra `phone_number_id`, `waba_id`, status badge. Form temporal con Phone Number ID, WABA ID, Access Token (solo en estado React, **nunca** se guarda en Supabase). Botón "Probar conexión" → POST al webhook n8n con el payload pedido. Maneja success/failure con badges y mensajes de ayuda por `error_step`. Refresca `whatsapp_accounts` desde Supabase tras la llamada. Limpia access token al terminar.
- **Clientes (`/clients`)**: tabla solo lectura de `contacts`, con búsqueda, filtro por status, orden por `last_interaction_at desc`. Empty state.
- **Conversaciones (`/conversations`)**: lista de `conversations` + panel de `messages` (inbound izquierda, outbound derecha, orden asc). Solo lectura.
- **Uso mensual (`/usage`)**: `usage_counters` del mes actual. Tarjetas + barras de progreso. Alertas 80%/100%. Si no hay registro → empty state (no crea nada).
- **Billing (`/billing`)**: muestra siempre el plan MVP descrito (Setup 499.000 COP, Mensualidad 299.000 COP, hasta 5.000 respuestas/mes, 1 WhatsApp, 1 asistente, 7 días optimización). Si `subscriptions` tiene datos, muestra plan, status, fechas, límite. Solo informativo.
- **Notificaciones (`/notifications`)**: calculadas en cliente desde `companies`, `assistants`, `whatsapp_accounts`, `usage_counters`. Sin tabla nueva. Empty state amistoso si no hay alertas.
- **Configuración (`/settings`)**: form para actualizar **solo** `companies.name`, `email`, `country`. Muestra `status` y `onboarding_status` como solo lectura.

## 6. Componentes reutilizables

`src/components/`: `AppLayout`, `AppSidebar`, `AppHeader`, `Logo`, `StatCard`, `StatusBadge`, `LoadingState`, `EmptyState`, `FormSection`, `ProgressBar`, `DataTable`, `NotificationCard`. Toasts vía `sonner`. Shadcn ya disponible para inputs, cards, tabs, dialog, etc.

## 7. Seguridad y reglas

- Solo anon key. RLS hace su trabajo.
- Access Token de Meta nunca se persiste en Supabase desde el frontend; solo se manda al webhook n8n.
- Webhook URL viene de `VITE_N8N_TEST_META_CONNECTION_WEBHOOK` (default al valor dado).
- Errores siempre con mensaje amigable en español; nunca intentar arreglar el backend.

## Detalles técnicos

- Stack: TanStack Start (ya configurado) + React 19 + Tailwind v4 + shadcn + sonner + `@supabase/supabase-js`.
- Tipos: archivo `src/lib/types.ts` con interfaces mínimas (`Profile`, `Company`, `Assistant`, `WhatsappAccount`, `UsageCounter`, `Contact`, `Conversation`, `Message`, `Subscription`) basadas solo en los campos que la UI consume; no genero tipos contra tu schema real.
- Data fetching: TanStack Query (ya en el template). `useQuery` con `queryKey: [tabla, companyId]` y `enabled: !!companyId`. Mutaciones solo para los campos permitidos.
- Sin server functions ni edge functions: todo client-side con anon key + RLS, como pides.
- No agrego: campañas, pagos, envío manual de mensajes.

## Pendiente de tu lado

- Subir el archivo `agentlabs-cloud-logo.png` (preferible versión horizontal sobre transparente). Mientras tanto, fallback de texto.
