type EmailPayload = {
  subject: string;
  replyTo?: string;
  text: string;
};

export function isEmailServiceConfigured() {
  return Boolean(
    process.env.CONTACT_RECEIVER_EMAIL &&
      process.env.EMAIL_FROM &&
      process.env.EMAIL_API_KEY
  );
}

export async function sendLeadEmail(payload: EmailPayload) {
  if (!isEmailServiceConfigured()) {
    if (process.env.NODE_ENV === "development") {
      console.info("[IMMO-DREAMS83] Email provider placeholder", payload);
    }

    return {
      sent: false,
      mode: "placeholder" as const,
    };
  }

  // TODO V3: connect Resend, Brevo or Mailgun here.
  // Keep SDK clients lazily initialized inside provider-specific getters.
  return {
    sent: false,
    mode: "not_implemented" as const,
  };
}
