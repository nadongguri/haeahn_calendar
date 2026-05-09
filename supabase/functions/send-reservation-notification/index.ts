import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type NotificationPayload = {
  reservationId: string;
  title: string;
  roomName: string;
  organizerEmail: string;
  attendees: string[];
  startTime: string;
  endTime: string;
};

serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const enabled = Deno.env.get("SEND_RESERVATION_EMAILS") === "true";
  if (!enabled) {
    return Response.json({
      sent: false,
      reason:
        "Reservation notification emails are disabled by default to protect free-tier email quotas."
    });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return Response.json(
      {
        sent: false,
        reason: "RESEND_API_KEY is not configured."
      },
      { status: 500 }
    );
  }

  const payload = (await request.json()) as NotificationPayload;
  const recipients = payload.attendees.filter(Boolean);

  if (recipients.length === 0) {
    return Response.json({ sent: false, reason: "No attendees provided." });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "haeahn_calendar <notifications@example.com>",
      to: recipients,
      subject: `Room booked: ${payload.title}`,
      text: [
        `${payload.organizerEmail} booked ${payload.roomName}.`,
        `Start: ${payload.startTime}`,
        `End: ${payload.endTime}`,
        `Reservation ID: ${payload.reservationId}`
      ].join("\n")
    })
  });

  if (!response.ok) {
    return Response.json(
      {
        sent: false,
        reason: await response.text()
      },
      { status: response.status }
    );
  }

  return Response.json({ sent: true, provider: "resend" });
});
