"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import koLocale from "@fullcalendar/core/locales/ko";
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
  const [mobileReadOnly, setMobileReadOnly] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const roomsResult = await supabase
      .from("rooms")
      .select("id, name, location, capacity, active")
      .eq("active", true)
      .order("name", { ascending: true });

    if (roomsResult.error) {
      setError(roomsResult.error.message);
      setLoading(false);
      return;
    }

    const activeRooms = (roomsResult.data ?? []) as Room[];
    setRooms(activeRooms);

    if (activeRooms.length === 0) {
      setReservations([]);
      setLoading(false);
      return;
    }

    const reservationsResult = await supabase
      .from("reservations")
      .select(reservationSelect)
      .in(
        "room_id",
        activeRooms.map((room) => room.id)
      )
      .order("start_time", { ascending: true });

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

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    function syncMobileState() {
      setMobileReadOnly(mediaQuery.matches);
    }

    syncMobileState();
    mediaQuery.addEventListener("change", syncMobileState);

    return () => mediaQuery.removeEventListener("change", syncMobileState);
  }, []);

  const events = useMemo<EventInput[]>(() => {
    return reservations.map((reservation) => {
      const ownReservation = reservation.organizer_user_id === userId;
      const roomName = reservation.rooms?.name ?? "회의실";
      return {
        id: reservation.id,
        title: `${roomName}: ${reservation.title}`,
        start: reservation.start_time,
        end: reservation.end_time,
        backgroundColor: ownReservation ? "#0e4e96" : "#a5abb3",
        borderColor: ownReservation ? "#0e4e96" : "#a5abb3",
        extendedProps: {
          reservation
        }
      };
    });
  }, [reservations, userId]);

  function openCreateModal(selection: DateSelectArg) {
    setModalError("");
    if (mobileReadOnly) {
      return;
    }

    if (rooms.length === 0) {
      setError("예약을 만들려면 활성화된 회의실이 필요합니다.");
      return;
    }

    const defaultSelection = getDefaultCreateRange(selection);

    setModal({
      kind: "create",
      start: defaultSelection.start,
      end: defaultSelection.end,
      reservation: null
    });
  }

  function openEventModal(clickInfo: EventClickArg) {
    const reservation = clickInfo.event.extendedProps
      .reservation as ReservationWithRoom;
    setModalError("");
    setModal({
      kind:
        !mobileReadOnly && reservation.organizer_user_id === userId
          ? "edit"
          : "view",
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
      setModalError("종료 시간은 시작 시간보다 늦어야 합니다.");
      setSubmitting(false);
      return;
    }

    if (!isTenMinuteBoundary(startIso) || !isTenMinuteBoundary(endIso)) {
      setModalError("예약 시간은 10분 단위로 선택해 주세요.");
      setSubmitting(false);
      return;
    }

    if (!values.roomId) {
      setModalError("회의실을 선택해 주세요.");
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
              9층 회의실
            </p>
            <h1 className="text-2xl font-bold text-ink">9층 회의실 예약</h1>
          </div>
          <div className="flex flex-col gap-2 text-sm sm:items-end">
            <span className="break-all text-muted">{userEmail}</span>
            <button
              className="rounded-md border border-line px-3 py-2 font-semibold text-ink transition hover:bg-panel"
              type="button"
              onClick={onSignOut}
            >
              로그아웃
            </button>
          </div>
        </header>

        {mobileReadOnly && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 md:hidden">
            모바일에서는 현재 예약 조회만 가능합니다. 예약 생성, 수정, 삭제는
            PC에서 진행해 주세요.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-lg border border-line bg-white px-4 py-10 text-center text-sm font-medium text-muted shadow-soft">
            예약 정보를 불러오는 중...
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
                right: "dayGridMonth,timeGridWeek"
              }}
              height="auto"
              initialView="timeGridWeek"
              locale={koLocale}
              nowIndicator
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              buttonText={{
                today: "오늘",
                month: "월",
                week: "주"
              }}
              selectable={!mobileReadOnly}
              selectMirror
              select={openCreateModal}
              slotMinTime="07:00:00"
              slotMaxTime="21:00:00"
              slotDuration="00:10:00"
              slotLabelFormat={{
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
              }}
              snapDuration="00:10:00"
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
        회의실 없음
      </p>
      <h2 className="mt-2 text-xl font-bold text-ink">
        Supabase에 회의실을 추가해 주세요
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
        <code className="rounded bg-panel px-1">README.md</code>의 seed SQL을 실행하거나{" "}
        <code className="rounded bg-panel px-1">rooms</code> 테이블에 활성 회의실을
        추가해 주세요. 활성 회의실이 하나 이상 있어야 캘린더가 표시됩니다.
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
    return "선택한 시간에는 이미 회의실이 예약되어 있습니다. 다른 시간을 선택해 주세요.";
  }

  if (error.code === "42501" || message.includes("row-level security")) {
    return "이 예약을 변경할 권한이 없습니다.";
  }

  return error.message;
}

function isTenMinuteBoundary(value: string) {
  const date = new Date(value);
  return (
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0 &&
    date.getMinutes() % 10 === 0
  );
}

function getDefaultCreateRange(selection: DateSelectArg) {
  if (!selection.allDay) {
    return {
      start: selection.start,
      end: selection.end
    };
  }

  const start = new Date(selection.start);
  start.setHours(9, 0, 0, 0);

  const end = new Date(selection.start);
  end.setHours(10, 0, 0, 0);

  return { start, end };
}
