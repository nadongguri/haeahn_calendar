export type Room = {
  id: string;
  name: string;
  location: string | null;
  capacity: number | null;
  active: boolean;
};

export type Reservation = {
  id: string;
  room_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  organizer_user_id: string;
  organizer_email: string;
  attendees: string[];
  send_notification: boolean;
  created_at: string;
  updated_at: string;
};

export type ReservationWithRoom = Reservation & {
  rooms?: Pick<Room, "name" | "location"> | null;
};

export type ReservationFormValues = {
  roomId: string;
  title: string;
  description: string;
  start: string;
  end: string;
  attendees: string;
  sendNotification: boolean;
};
