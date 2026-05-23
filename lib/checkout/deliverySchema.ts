import { z } from "zod";

/**
 * Strip everything except digits, then take the last 10 (handles +91, spaces, dashes).
 * Schema requires exactly 10 digits after normalization — anything shorter is rejected.
 */
const INDIA_PHONE_RE = /^[6-9]\d{9}$/;

export const deliverySchema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email"),
  phone: z
    .string()
    .transform((s) => s.replace(/\D/g, "").slice(-10))
    .pipe(
      z
        .string()
        .regex(
          INDIA_PHONE_RE,
          "Enter a valid 10-digit mobile (starting 6–9)"
        )
    ),
  line1: z.string().min(3, "Address line 1 is required"),
  line2: z.string().optional(),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z
    .string()
    .regex(/^\d{6}$/, "PIN code must be 6 digits"),
});

export type DeliveryFormValues = z.infer<typeof deliverySchema>;
