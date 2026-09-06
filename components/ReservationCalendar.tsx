"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import koLocale from "@fullcalendar/core/locales/ko";
import type {
  DateSelectArg,
  DayHeaderContentArg,
  EventClickArg,
  EventInput
} from "@fullcalendar/core";
import { ReservationModal } from "@/components/ReservationModal";
import {
  dateTimeLocalToIso,
  parseAttendees,
  RESERVATION_INTERVAL_MINUTES
} from "@/lib/date";
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

const todayFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short"
});
const weekdayFormatter = new Intl.DateTimeFormat("ko-KR", { weekday: "short" });

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
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [todayLabel, setTodayLabel] = useState("");
  const calendarRef = useRef<FullCalendar>(null);

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
    function updateToday() {
      setTodayLabel(todayFormatter.format(new Date()));
    }

    updateToday();
    const timer = window.setInterval(updateToday, 60_000);
    document.addEventListener("visibilitychange", updateToday);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", updateToday);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    function syncMobileState() {
      setIsMobile(mediaQuery.matches);
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
        title: isMobile ? reservation.title : `${roomName}: ${reservation.title}`,
        start: reservation.start_time,
        end: reservation.end_time,
        backgroundColor: ownReservation ? "#0e4e96" : "#626d7b",
        borderColor: ownReservation ? "#0e4e96" : "#626d7b",
        extendedProps: {
          reservation
        }
      };
    });
  }, [reservations, userId, isMobile]);

  function openCreateModal(
    selection: Pick<DateSelectArg, "start" | "end" | "allDay">
  ) {
    setModalError("");

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

  function openNewReservation() {
    const date = calendarRef.current?.getApi().getDate() ?? new Date();
    openCreateModal({ start: date, end: date, allDay: true });
  }

  function openTappedDate(clickInfo: DateClickArg) {
    if (!isMobile) return;

    const start = new Date(clickInfo.date);
    const end = new Date(start.getTime() + RESERVATION_INTERVAL_MINUTES * 60_000);
    const closingTime = new Date(start);
    closingTime.setHours(18, 0, 0, 0);

    openCreateModal({
      start,
      end: end > closingTime ? closingTime : end,
      allDay: clickInfo.allDay
    });
  }

  function openEventModal(clickInfo: EventClickArg) {
    const reservation = clickInfo.event.extendedProps
      .reservation as ReservationWithRoom;
    setModalError("");
    setModal({
      kind:
        reservation.organizer_user_id === userId
          ? "edit"
          : "view",
      start: null,
      end: null,
      reservation
    });
  }

  async function saveReservation(values: ReservationFormValues) {
    if (submitting) return;
    setSubmitting(true);
    setModalError("");

    if (
      !Number.isFinite(new Date(values.start).getTime()) ||
      !Number.isFinite(new Date(values.end).getTime())
    ) {
      setModalError("시작과 종료 날짜 및 시간을 확인해 주세요.");
      setSubmitting(false);
      return;
    }

    const startIso = dateTimeLocalToIso(values.start);
    const endIso = dateTimeLocalToIso(values.end);

    if (new Date(endIso) <= new Date(startIso)) {
      setModalError("종료 시간은 시작 시간보다 늦어야 합니다.");
      setSubmitting(false);
      return;
    }

    const existingReservation = modal?.kind === "edit" ? modal.reservation : null;
    const timeUnchanged = existingReservation &&
      new Date(startIso).getTime() === new Date(existingReservation.start_time).getTime() &&
      new Date(endIso).getTime() === new Date(existingReservation.end_time).getTime();

    if (!timeUnchanged && (!isReservationBoundary(startIso) || !isReservationBoundary(endIso))) {
      setModalError(`예약 시간은 ${RESERVATION_INTERVAL_MINUTES}분 단위로 선택해 주세요.`);
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
            <h1 className="text-xl font-bold text-ink sm:text-2xl">9층 회의실 예약</h1>
            {todayLabel && (
              <p className="mt-1 text-sm font-medium text-accent">오늘 {todayLabel}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 text-sm sm:items-end">
            <span className="break-all text-muted">{userEmail}</span>
            <div className="flex flex-wrap gap-2">
              <button
                className="min-h-11 rounded-md bg-accent px-4 py-2 font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading || rooms.length === 0 || isMobile === null}
                type="button"
                onClick={openNewReservation}
              >
                새 예약
              </button>
              <button
                className="min-h-11 rounded-md border border-line px-3 py-2 font-semibold text-ink transition hover:bg-panel"
                type="button"
                onClick={onSignOut}
              >
                로그아웃
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {(loading && rooms.length === 0) || isMobile === null ? (
          <div className="rounded-lg border border-line bg-white px-4 py-10 text-center text-sm font-medium text-muted shadow-soft">
            예약 정보를 불러오는 중...
          </div>
        ) : rooms.length === 0 ? (
          <EmptyRoomsState />
        ) : (
          <section aria-busy={loading} className="rounded-lg border border-line bg-white p-3 shadow-soft sm:p-4">
            <FullCalendar
              ref={calendarRef}
              allDaySlot={false}
              dateClick={openTappedDate}
              dayMaxEvents={isMobile ? 2 : false}
              eventDisplay={isMobile ? "block" : "auto"}
              eventClick={openEventModal}
              eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
              events={events}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay"
              }}
              height="auto"
              initialView={isMobile ? "dayGridMonth" : "timeGridWeek"}
              locale={koLocale}
              nowIndicator
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              buttonText={{
                today: "오늘",
                month: "월",
                week: "주",
                day: "일"
              }}
              selectable={!isMobile}
              selectMirror
              select={openCreateModal}
              slotMinTime="08:00:00"
              slotMaxTime="18:00:00"
              slotDuration={{ minutes: RESERVATION_INTERVAL_MINUTES }}
              slotLabelInterval={{ minutes: RESERVATION_INTERVAL_MINUTES }}
              slotLabelFormat={{
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
              }}
              snapDuration={{ minutes: RESERVATION_INTERVAL_MINUTES }}
              weekends
              views={{
                dayGridMonth: {
                  dayCellContent: (info) => (
                    <span
                      aria-current={info.isToday ? "date" : undefined}
                      className="calendar-month-day"
                    >
                      {isMobile ? String(info.date.getDate()) : info.dayNumberText}
                    </span>
                  )
                },
                timeGridWeek: {
                  weekends: false,
                  dayHeaderContent: renderTimeGridHeader
                },
                timeGridDay: {
                  dayHeaderContent: renderTimeGridHeader
                }
              }}
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

function renderTimeGridHeader(info: DayHeaderContentArg) {
  return (
    <span
      aria-current={info.isToday ? "date" : undefined}
      aria-label={`${todayFormatter.format(info.date)}${info.isToday ? ", 오늘" : ""}`}
      className="calendar-day-header"
    >
      <span className="calendar-day-header-date">
        {info.date.getMonth() + 1}.{info.date.getDate()}
      </span>
      <span className="calendar-day-header-weekday">
        ({weekdayFormatter.format(info.date)})
      </span>
    </span>
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

function isReservationBoundary(value: string) {
  const date = new Date(value);
  return (
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0 &&
    date.getMinutes() % RESERVATION_INTERVAL_MINUTES === 0
  );
}

function getDefaultCreateRange(
  selection: Pick<DateSelectArg, "start" | "end" | "allDay">
) {
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
