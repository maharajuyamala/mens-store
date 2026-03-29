import { z } from "zod";

export const deliverySchema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email"),
  phone: z
    .string()
    .min(10, "Enter a valid phone number")
    .regex(/^[\d\s+()-]{10,20}$/, "Enter a valid phone number"),
  line1: z.string().min(3, "Address line 1 is required"),
  line2: z.string().optional(),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z
    .string()
    .regex(/^\d{6}$/, "PIN code must be 6 digits"),
});

export type DeliveryFormValues = z.infer<typeof deliverySchema>;
