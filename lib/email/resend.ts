import "server-only";
import { Resend } from "resend";

let cached: Resend | null | undefined;

function getResend(): Resend | null {
  if (cached === undefined) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.warn(
        "[email] RESEND_API_KEY is not set. Transactional emails will be skipped."
      );
      cached = null;
    } else {
      cached = new Resend(key);
    }
  }
  return cached;
}

function senderAddress(): string {
  return (
    process.env.RESEND_FROM_ADDRESS?.trim() ||
    "SecondSkin <orders@secondskinmensworld.com>"
  );
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

/** Returns true if Resend accepted the message, false otherwise. Never throws. */
export async function sendTransactionalEmail(
  input: SendEmailInput
): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;
  try {
    const r = await resend.emails.send({
      from: senderAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    });
    if (r.error) {
      console.error("[email] resend rejected", r.error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] send failed", e);
    return false;
  }
}
