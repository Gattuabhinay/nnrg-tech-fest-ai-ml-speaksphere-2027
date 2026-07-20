/**
 * Local UPI fallback so the QR can render on first paint
 * without waiting for the event_config network call.
 * Supabase values still win when they arrive.
 */
export const PAYMENT_DEFAULTS = {
  upiId: "7730001471@ibl",
  upiName: "DEEPAK G",
  upiPhone: "7730001471",
} as const;
