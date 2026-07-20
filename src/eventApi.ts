import QRCode from "qrcode";
import { PAYMENT_DEFAULTS } from "./paymentDefaults";

/**
 * Production: browser calls same-origin Vercel proxy (/api/smart-api).
 * Supabase URL + access token live ONLY in Vercel env (server-side).
 * Local Vite dev still talks to smart-api directly.
 */
export const REGISTER_ENDPOINT = import.meta.env.DEV
  ? "https://npdpdzutluesuwzofvcd.supabase.co/functions/v1/smart-api"
  : "/api/smart-api";

/** Dev-only. Production token is injected by Vercel /api/smart-api (never ship in bundle). */
export const REGISTER_ACCESS_TOKEN = import.meta.env.DEV
  ? "nnrg-tara-2027-reg-k7m9x2q4w8"
  : "";

export type Coordinator = {
  name: string;
  phone: string;
};

export type SupabaseEventConfig = {
  slug: string;
  name: string;
  short_name: string;
  description: string | null;
  participation: "solo" | "duo" | "team";
  min_members: number;
  max_members: number;
  fee_amount: number;
  coordinator_name: string;
  coordinator_phone: string;
  venue: string | null;
  venue_map_url: string | null;
  student_coordinator_name: string | null;
  student_coordinator_phone: string | null;
  whatsapp_redirect_name: string | null;
  whatsapp_redirect_phone: string | null;
  upi_id: string | null;
  upi_name: string | null;
  upi_phone: string | null;
  payment_note: string | null;
  fest_year: number | null;
  event_date: string | null;
  reporting_time: string | null;
  event_start_time: string | null;
  event_end_time: string | null;
  schedule_note: string | null;
  faculty_coordinators: unknown;
  student_coordinators: unknown;
  faculty_coordinator_1_name: string | null;
  faculty_coordinator_1_phone: string | null;
  faculty_coordinator_2_name: string | null;
  faculty_coordinator_2_phone: string | null;
  faculty_coordinator_3_name: string | null;
  faculty_coordinator_3_phone: string | null;
  student_coordinator_1_name: string | null;
  student_coordinator_1_phone: string | null;
  student_coordinator_2_name: string | null;
  student_coordinator_2_phone: string | null;
  student_coordinator_3_name: string | null;
  student_coordinator_3_phone: string | null;
  resource_enabled: boolean;
  resource_section_heading: string | null;
  resource_banner_text: string | null;
  resource_title: string | null;
  resource_subtitle: string | null;
  resource_view_url: string | null;
  resource_download_url: string | null;
  resource_tip: string | null;
  registrations_open?: boolean;
};

export type EventResource = {
  sectionHeading: string;
  bannerText: string;
  title: string;
  subtitle: string;
  viewUrl: string;
  downloadUrl: string;
  tip: string;
  viewLabel: string;
  downloadLabel: string;
};

export async function fetchEventConfig(slug: string): Promise<SupabaseEventConfig | null> {
  try {
    const response = await fetch(REGISTER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "event_config", event_slug: slug }),
    });
    const result = await response.json();
    if (!response.ok || !result.event) return null;
    return result.event as SupabaseEventConfig;
  } catch {
    return null;
  }
}

function formatTimeValue(value: string) {
  const [hourText, minuteText = "00"] = value.split(":");
  const hour = Number(hourText);
  if (Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minuteText.slice(0, 2)} ${suffix}`;
}

export function formatEventDate(value: string | null | undefined, fallback = "") {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatEventTime(
  start: string | null | undefined,
  end: string | null | undefined,
  reporting: string | null | undefined,
  fallback = ""
) {
  if (reporting && start) {
    return `${formatTimeValue(reporting)} (Report) / ${formatTimeValue(start)} (Start)`;
  }
  if (start && end) return `${formatTimeValue(start)} - ${formatTimeValue(end)}`;
  if (start) return formatTimeValue(start);
  return fallback;
}

export function teamLabelFromMembers(minMembers: number, maxMembers: number, fallback = "") {
  if (minMembers === maxMembers) {
    if (minMembers === 1) return "Solo";
    return `${minMembers} Members`;
  }
  return `${minMembers}-${maxMembers} Members`;
}

export function feeLabelFromAmount(fee: number, minMembers: number, maxMembers: number, fallback = "") {
  if (minMembers === 1 && maxMembers === 1) return `₹${fee}`;
  return fallback || `₹${fee} / Team`;
}

export function heroFeeLabelFromAmount(fee: number, minMembers: number, maxMembers: number, fallback = "") {
  if (minMembers === 1 && maxMembers === 1) return `₹${fee}`;
  return fallback || `₹${fee}/team`;
}

export function buildUpiPaymentString(upiId: string, upiName: string, note: string) {
  const pa = upiId.trim();
  const pn = upiName.trim();
  const tn = note.trim().slice(0, 50);
  const parts = [
    `pa=${encodeURIComponent(pa)}`,
    `pn=${encodeURIComponent(pn)}`,
    `cu=INR`,
  ];
  if (tn) parts.push(`tn=${encodeURIComponent(tn)}`);
  return `upi://pay?${parts.join("&")}`;
}

const upiQrMemoryCache = new Map<string, string>();

function readCachedQr(payload: string) {
  const cached = upiQrMemoryCache.get(payload);
  if (cached) return cached;
  const storageKey = `nnrg-upi-qr:${payload}`;
  try {
    const fromSession = sessionStorage.getItem(storageKey);
    if (fromSession) {
      upiQrMemoryCache.set(payload, fromSession);
      return fromSession;
    }
  } catch {
    /* private mode / blocked storage */
  }
  return "";
}

function writeCachedQr(payload: string, dataUrl: string) {
  upiQrMemoryCache.set(payload, dataUrl);
  try {
    sessionStorage.setItem(`nnrg-upi-qr:${payload}`, dataUrl);
  } catch {
    /* ignore quota */
  }
}

/**
 * Sync local UPI QR — no QuickChart, no extra network chunk.
 * Uses static qrcode import so generation is instant on first paint.
 */
export function buildUpiQrDataUrlSync(upiId: string, upiName: string, note: string) {
  const payload = buildUpiPaymentString(upiId, upiName, note);
  if (!upiId.trim() || !upiName.trim()) return "";

  const cached = readCachedQr(payload);
  if (cached) return cached;

  // Draw synchronously on an offscreen canvas (no second JS download).
  const canvas = document.createElement("canvas");
  // qrcode's toCanvas is async; create() + manual draw keeps first paint instant.
  const model = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const modules = model.modules;
  const count = modules.size;
  const margin = 1;
  const scale = Math.max(2, Math.floor(280 / (count + margin * 2)));
  const size = (count + margin * 2) * scale;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#000000";
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (modules.get(row, col)) {
        ctx.fillRect((col + margin) * scale, (row + margin) * scale, scale, scale);
      }
    }
  }
  const dataUrl = canvas.toDataURL("image/png");
  writeCachedQr(payload, dataUrl);
  return dataUrl;
}

/** Async wrapper kept for callers; resolves immediately via sync path. */
export async function buildUpiQrDataUrl(upiId: string, upiName: string, note: string) {
  return buildUpiQrDataUrlSync(upiId, upiName, note);
}

function coordinatorsFromColumns(columns: Array<[string | null | undefined, string | null | undefined]>) {
  return columns
    .filter(([name]) => Boolean(name?.trim()))
    .map(([name, phone]) => ({ name: name!.trim(), phone: phone?.trim() || "" }));
}

function isPlaceholderCoordinatorName(name: string) {
  const normalized = name.trim().toUpperCase();
  return normalized.startsWith("UPDATE_") || normalized.includes("PLACEHOLDER");
}

function parseCoordinatorJson(value: unknown) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  return value;
}

function coordinatorsFromJson(value: unknown) {
  const parsed = parseCoordinatorJson(value);
  if (!Array.isArray(parsed)) return [] as Coordinator[];
  return parsed
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      const phone =
        typeof record.phone === "string"
          ? record.phone.trim()
          : typeof record.mobile === "string"
            ? record.mobile.trim()
            : "";
      if (!name || isPlaceholderCoordinatorName(name)) return null;
      return { name, phone };
    })
    .filter((item): item is Coordinator => Boolean(item));
}

export function getFacultyCoordinators(event: SupabaseEventConfig | null) {
  if (!event) return [] as Coordinator[];
  const fromColumns = coordinatorsFromColumns([
    [event.faculty_coordinator_1_name, event.faculty_coordinator_1_phone],
    [event.faculty_coordinator_2_name, event.faculty_coordinator_2_phone],
    [event.faculty_coordinator_3_name, event.faculty_coordinator_3_phone],
  ]);
  if (fromColumns.length) return fromColumns;
  return coordinatorsFromJson(event.faculty_coordinators);
}

export function getStudentCoordinators(event: SupabaseEventConfig | null) {
  if (!event) return [] as Coordinator[];
  const fromColumns = coordinatorsFromColumns([
    [event.student_coordinator_1_name, event.student_coordinator_1_phone],
    [event.student_coordinator_2_name, event.student_coordinator_2_phone],
    [event.student_coordinator_3_name, event.student_coordinator_3_phone],
  ]);
  if (fromColumns.length) return fromColumns;
  return coordinatorsFromJson(event.student_coordinators);
}

export function getWhatsAppRedirect(event: SupabaseEventConfig | null): { name: string; phone: string } | null {
  if (!event) return null;
  const phone =
    event.whatsapp_redirect_phone?.trim() ||
    event.student_coordinator_1_phone?.trim() ||
    event.coordinator_phone?.trim() ||
    "";
  const name =
    event.whatsapp_redirect_name?.trim() ||
    event.student_coordinator_1_name?.trim() ||
    event.coordinator_name?.trim() ||
    "";
  if (!name && !phone) return null;
  return { name: name || "Coordinator", phone };
}

export function getPaymentDetails(event: SupabaseEventConfig | null, staticFee: number) {
  return {
    // Local defaults first so QR never waits on internet for UPI fields.
    upiId: event?.upi_id?.trim() || PAYMENT_DEFAULTS.upiId,
    upiPhone: event?.upi_phone?.trim() || PAYMENT_DEFAULTS.upiPhone,
    upiName: event?.upi_name?.trim() || PAYMENT_DEFAULTS.upiName,
    amount: event?.fee_amount ?? staticFee,
    note: event?.payment_note?.trim() || "",
  };
}

export function normalizeIndianPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

export function buildWhatsAppUrl(phone: string, text?: string) {
  const normalized = normalizeIndianPhone(phone);
  const base = `https://wa.me/${normalized}`;
  if (!text?.trim()) return base;
  return `${base}?text=${encodeURIComponent(text.trim())}`;
}

export function openWhatsApp(url: string) {
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.assign(url);
    return;
  }
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (!popup) window.location.assign(url);
}

const RESOURCE_BUTTON_LABELS: Record<string, { view: string; download: string }> = {
  "EVENT TIPS & GUIDANCE": { view: "View Guide", download: "Download PDF" },
  "DEMO QUESTIONS": { view: "View PDF", download: "Download PDF" },
  "PREVIOUS WINNERS": { view: "View Winners", download: "Download PDF" },
};

export function getEventResource(
  event: SupabaseEventConfig | null,
  fallbackName: string,
  festYear: number
): EventResource | null {
  if (!event?.resource_enabled || event.slug === "quickpuzzle") return null;

  const viewUrl = event.resource_view_url?.trim() || "";
  const downloadUrl = event.resource_download_url?.trim() || viewUrl;
  if (!viewUrl && !downloadUrl) return null;

  const sectionHeading = event.resource_section_heading?.trim() || "RESOURCES";
  const labels = RESOURCE_BUTTON_LABELS[sectionHeading] || { view: "View", download: "Download" };

  return {
    sectionHeading,
    bannerText:
      event.resource_banner_text?.trim() ||
      `Prepare better for ${fallbackName} ${festYear}!`,
    title: event.resource_title?.trim() || `${fallbackName} — Resources`,
    subtitle: event.resource_subtitle?.trim() || "",
    viewUrl,
    downloadUrl,
    tip: event.resource_tip?.trim() || "Tip: Shared for preparation only.",
    viewLabel: labels.view,
    downloadLabel: labels.download,
  };
}
