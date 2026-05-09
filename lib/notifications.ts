import type { Reservation } from "@/lib/types";

export type ReservationNotificationPayload = Pick<
  Reservation,
  | "id"
  | "title"
  | "description"
  | "start_time"
  | "end_time"
  | "organizer_email"
  | "attendees"
> & {
  roomName: string;
};

export const reservationNotificationsEnabled = false;

export async function sendReservationNotification(
  payload: ReservationNotificationPayload
) {
  void payload;

  return {
    sent: false,
    reason:
      "Reservation notification emails are disabled by default to protect free-tier email quotas."
  };
}
