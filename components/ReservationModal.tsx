"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  attendeesToInput,
  formatDateTime,
  toDateTimeLocalValue
} from "@/lib/date";
import type {
  ReservationFormValues,
  ReservationWithRoom,
  Room
} from "@/lib/types";

type ReservationModalProps = {
  mode: "create" | "edit" | "view";
  rooms: Room[];
  reservation?: ReservationWithRoom | null;
  selectedStart?: Date | null;
  selectedEnd?: Date | null;
  currentUserId: string;
  error?: string;
  submitting: boolean;
  onClose: () => void;
  onDelete: (reservationId: string) => void;
  onSubmit: (values: ReservationFormValues) => void;
};

export function ReservationModal({
  mode,
  rooms,
  reservation,
  selectedStart,
  selectedEnd,
  currentUserId,
  error,
  submitting,
  onClose,
  onDelete,
  onSubmit
}: ReservationModalProps) {
  const isReadOnly = mode === "view";
  const canDelete = mode === "edit" && reservation?.organizer_user_id === currentUserId;

  const initialValues = useMemo<ReservationFormValues>(() => {
    return {
      roomId: reservation?.room_id ?? rooms[0]?.id ?? "",
      title: reservation?.title ?? "",
      description: reservation?.description ?? "",
      start: toDateTimeLocalValue(
        reservation?.start_time ?? selectedStart ?? new Date(0)
      ),
      end: toDateTimeLocalValue(
        reservation?.end_time ??
          selectedEnd ??
          new Date((selectedStart ?? new Date(0)).getTime() + 30 * 60 * 1000)
      ),
      attendees: attendeesToInput(reservation?.attendees),
      sendNotification: false
    };
  }, [reservation, rooms, selectedEnd, selectedStart]);

  const [values, setValues] = useState(initialValues);

  function updateValue<K extends keyof ReservationFormValues>(
    key: K,
    value: ReservationFormValues[K]
  ) {
    setValues((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isReadOnly) {
      onSubmit(values);
    }
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8"
      role="dialog"
    >
      <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-line bg-white shadow-soft">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-ink">
              {mode === "create"
                ? "New reservation"
                : mode === "edit"
                  ? "Edit reservation"
                  : "Reservation details"}
            </h2>
            {reservation && (
              <p className="mt-1 text-sm text-muted">
                Organized by {reservation.organizer_email}
              </p>
            )}
          </div>
          <button
            className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-panel"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <form className="space-y-4 px-5 py-5" onSubmit={handleSubmit}>
          {isReadOnly && reservation && (
            <div className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-muted">
              {formatDateTime(reservation.start_time)} -{" "}
              {formatDateTime(reservation.end_time)}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-ink">Start</span>
              <input
                className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-panel disabled:text-muted"
                disabled={isReadOnly}
                required
                type="datetime-local"
                value={values.start}
                onChange={(event) => updateValue("start", event.target.value)}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-ink">End</span>
              <input
                className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-panel disabled:text-muted"
                disabled={isReadOnly}
                required
                type="datetime-local"
                value={values.end}
                onChange={(event) => updateValue("end", event.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-ink">Meeting room</span>
            <select
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-panel disabled:text-muted"
              disabled={isReadOnly}
              required
              value={values.roomId}
              onChange={(event) => updateValue("roomId", event.target.value)}
            >
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                  {room.location ? ` - ${room.location}` : ""}
                  {room.capacity ? ` (${room.capacity})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink">Title</span>
            <input
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-panel disabled:text-muted"
              disabled={isReadOnly}
              maxLength={140}
              required
              value={values.title}
              onChange={(event) => updateValue("title", event.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink">Description</span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-line px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-panel disabled:text-muted"
              disabled={isReadOnly}
              value={values.description}
              onChange={(event) =>
                updateValue("description", event.target.value)
              }
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink">Attendees</span>
            <input
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-panel disabled:text-muted"
              disabled={isReadOnly}
              placeholder="a@example.com, b@example.com"
              value={values.attendees}
              onChange={(event) => updateValue("attendees", event.target.value)}
            />
          </label>

          <label className="flex items-start gap-3 rounded-md border border-dashed border-line bg-panel px-3 py-3 text-sm text-muted">
            <input
              checked={false}
              className="mt-1"
              disabled
              type="checkbox"
              onChange={() => updateValue("sendNotification", false)}
            />
            <span>
              <span className="block font-semibold text-ink">
                Send notification email
              </span>
              Feature temporarily disabled
            </span>
          </label>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <div>
              {canDelete && reservation && (
                <button
                  className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting}
                  type="button"
                  onClick={() => onDelete(reservation.id)}
                >
                  Delete
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-panel"
                type="button"
                onClick={onClose}
              >
                Cancel
              </button>
              {!isReadOnly && (
                <button
                  className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting ? "Saving..." : "Confirm"}
                </button>
              )}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
