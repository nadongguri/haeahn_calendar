"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { DateSelectArg, EventClickArg, EventInput } from "@fullcalendar/core";
import { ReservationModal } from "@/components/ReservationModal";
import { dateTimeLocalToIso, parseAttendees } from "@/lib/date";
import { supabase } from "@/lib/supabase";
import type {
  ReservationFormValues,
  ReservationWithRoom,
  Room
} from "@/lib/types";

type ReservationCalendarProps = {
  userEmail: string;
  userId: string;
  onSignOut: () => void;
};

type ModalState =
  | {
      kind: "create";
      start: Date;
      end: Date;
      reservation: null;
    }
  | {
      kind: "edit" | "view";
      start: null;
      end: null;
      reservation: ReservationWithRoom;
    }
  | null;

const reservationSelect =
  "id, room_id, title, description, start_time, end_time, organizer_user_id, organizer_email, attendees, send_notification, created_at, updated_at, rooms(name, location)";

export function ReservationCalendar({
  userEmail,
  userId,
  onSignOut
}: ReservationCalendarProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<ReservationWithRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const [roomsResult, reservationsResult] = await Promise.all([
      supabase
        .from("rooms")
        .select("id, name, location, capacity, active")
        .eq("active", true)
        .order("name", { ascending: true }),
      supabase
        .from("reservations")
        .select(reservationSelect)
        .order("start_time", { ascending: true })
    ]);

    if (roomsResult.error) {
      setError(roomsResult.error.message);
    } else {
      setRooms((roomsResult.data ?? []) as Room[]);
    }

    if (reservationsResult.error) {
      setError(reservationsResult.error.message);
    } else {
      const normalizedReservations = (reservationsResult.data ?? []).map(
        (reservation) => ({
          ...reservation,
          rooms: Array.isArray(reservation.rooms)
            ? (reservation.rooms[0] ?? null)
            : reservation.rooms
        })
      );
      setReservations(normalizedReservations as unknown as ReservationWithRoom[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const events = useMemo<EventInput[]>(() => {
    return reservations.map((reservation) => {
      const ownReservation = reservation.organizer_user_id === userId;
      const roomName = reservation.rooms?.name ?? "Room";
      return {
        id: reservation.id,
        title: `${roomName}: ${reservation.title}`,
        start: reservation.start_time,
        end: reservation.end_time,
        backgroundColor: ownReservation ? "#0f766e" : "#475467",
        borderColor: ownReservation ? "#0f766e" : "#475467",
        extendedProps: {
          reservation
        }
      };
    });
  }, [reservations, userId]);

  function openCreateModal(selection: DateSelectArg) {
    setModalError("");
    if (rooms.length === 0) {
      setError("Add at least one active room before creating reservations.");
      return;
    }

    setModal({
      kind: "create",
      start: selection.start,
      end: selection.end,
      reservation: null
    });
  }

  function openEventModal(clickInfo: EventClickArg) {
    const reservation = clickInfo.event.extendedProps
      .reservation as ReservationWithRoom;
    setModalError("");
    setModal({
      kind: reservation.organizer_user_id === userId ? "edit" : "view",
      start: null,
      end: null,
      reservation
    });
  }

  async function saveReservation(values: ReservationFormValues) {
    setSubmitting(true);
    setModalError("");

    const startIso = dateTimeLocalToIso(values.start);
    const endIso = dateTimeLocalToIso(values.end);

    if (new Date(endIso) <= new Date(startIso)) {
      setModalError("End time must be after start time.");
      setSubmitting(false);
      return;
    }

    if (!values.roomId) {
      setModalError("Select a meeting room before saving.");
      setSubmitting(false);
      return;
    }

    const payload = {
      room_id: values.roomId,
      title: values.title.trim(),
      description: values.description.trim(),
      start_time: startIso,
      end_time: endIso,
      attendees: parseAttendees(values.attendees),
      send_notification: false
    };

    const result =
      modal?.kind === "edit" && modal.reservation
        ? await supabase
            .from("reservations")
            .update(payload)
            .eq("id", modal.reservation.id)
        : await supabase.from("reservations").insert({
            ...payload,
            organizer_user_id: userId,
            organizer_email: userEmail
          });

    if (result.error) {
      setModalError(toFriendlyReservationError(result.error));
      setSubmitting(false);
      return;
    }

    await loadData();
    setSubmitting(false);
    setModal(null);
  }

  async function deleteReservation(reservationId: string) {
    setSubmitting(true);
    setModalError("");

    const { error: deleteError } = await supabase
      .from("reservations")
      .delete()
      .eq("id", reservationId);

    if (deleteError) {
      setModalError(deleteError.message);
      setSubmitting(false);
      return;
    }

    await loadData();
    setSubmitting(false);
    setModal(null);
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <section className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="flex flex-col gap-3 rounded-lg border border-line bg-white px-4 py-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Meeting rooms
            </p>
            <h1 className="text-2xl font-bold text-ink">Room reservations</h1>
          </div>
          <div className="flex flex-col gap-2 text-sm sm:items-end">
            <span className="break-all text-muted">{userEmail}</span>
            <button
              className="rounded-md border border-line px-3 py-2 font-semibold text-ink transition hover:bg-panel"
              type="button"
              onClick={onSignOut}
            >
              Sign out
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-lg border border-line bg-white px-4 py-10 text-center text-sm font-medium text-muted shadow-soft">
            Loading reservations...
          </div>
        ) : rooms.length === 0 ? (
          <EmptyRoomsState />
        ) : (
          <section className="rounded-lg border border-line bg-white p-3 shadow-soft sm:p-4">
            <FullCalendar
              allDaySlot={false}
              eventClick={openEventModal}
              events={events}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay"
              }}
              height="auto"
              initialView="timeGridWeek"
              nowIndicator
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              selectable
              selectMirror
              select={openCreateModal}
              slotMinTime="07:00:00"
              slotMaxTime="21:00:00"
              weekends
            />
          </section>
        )}
      </section>

      {modal && (
        <ReservationModal
          currentUserId={userId}
          error={modalError}
          mode={modal.kind}
          reservation={modal.reservation}
          rooms={rooms}
          selectedEnd={modal.end}
          selectedStart={modal.start}
          submitting={submitting}
          onClose={() => setModal(null)}
          onDelete={deleteReservation}
          onSubmit={saveReservation}
        />
      )}
    </main>
  );
}

function EmptyRoomsState() {
  return (
    <section className="rounded-lg border border-dashed border-line bg-white px-5 py-12 text-center shadow-soft">
      <p className="text-sm font-semibold uppercase tracking-wide text-accent">
        No rooms
      </p>
      <h2 className="mt-2 text-xl font-bold text-ink">
        Add meeting rooms in Supabase
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
        Run the seed SQL from <code className="rounded bg-panel px-1">README.md</code>{" "}
        or insert active rows into <code className="rounded bg-panel px-1">rooms</code>.
        The calendar will appear after at least one active room exists.
      </p>
    </section>
  );
}

function toFriendlyReservationError(error: { code?: string; message: string }) {
  const message = error.message.toLowerCase();

  if (
    error.code === "23P01" ||
    message.includes("reservations_room_time_no_overlap") ||
    message.includes("conflicting key value violates exclusion constraint")
  ) {
    return "That room is already booked for the selected time. Choose a different room or time range.";
  }

  if (error.code === "42501" || message.includes("row-level security")) {
    return "You do not have permission to change that reservation.";
  }

  return error.message;
}
