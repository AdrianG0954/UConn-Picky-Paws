import dayGridPlugin from "@fullcalendar/daygrid";
import type { EventInput } from "@fullcalendar/core";
import FullCalendar from "@fullcalendar/react";
import { useEffect, useState } from "react";

import { fetchMealAvailability } from "../../api";
import type { FoodAvailabilityResponse } from "../../types/meals";
import { errorMessage } from "../../utils/errorMessage";

function titleCaseLabel(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function mealTone(meal: string): string {
  if (meal === "breakfast") return "availability-event-breakfast";
  if (meal === "lunch") return "availability-event-lunch";
  return "availability-event-dinner";
}

type Props = {
  isAvailabilityModalOpen: boolean;
  setIsAvailabilityModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  foodItem: string | null;
};

export function AvailabilityModal({
  isAvailabilityModalOpen,
  setIsAvailabilityModalOpen,
  foodItem,
}: Props) {
  const [availability, setAvailability] =
    useState<FoodAvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAvailabilityModalOpen || !foodItem) {
      return;
    }

    let cancelled = false;

    const loadAvailability = async () => {
      setLoading(true);
      setRequestError(null);

      try {
        const response = await fetchMealAvailability(foodItem);
        if (!cancelled) {
          setAvailability(response);
        }
      } catch (e) {
        if (!cancelled) {
          setAvailability(null);
          setRequestError(errorMessage(e, "Failed to load availability."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [foodItem, isAvailabilityModalOpen]);

  if (!isAvailabilityModalOpen) {
    return null;
  }

  const events: EventInput[] = availability
    ? availability.days.flatMap((day) =>
        day.availabilities.map((entry) => ({
          title: `${titleCaseLabel(entry.meal)} at ${titleCaseLabel(entry.dining_hall)}`,
          date: day.date,
          classNames: [mealTone(entry.meal)],
          extendedProps: {
            meal: titleCaseLabel(entry.meal),
            diningHall: titleCaseLabel(entry.dining_hall),
          },
        })),
      )
    : [];

  const hasResults = events.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-[1.75rem] border border-zinc-200/80 bg-white p-5 shadow-2xl shadow-zinc-900/10 md:p-7">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-uconn-navy md:text-3xl">
              {foodItem ? `${foodItem} availability` : "Availability"}
            </h2>
            <p className="mt-2 text-sm text-zinc-600 md:text-base">
              Current week across all dining halls.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAvailabilityModalOpen(false)}
            className="rounded-xl px-3 py-2 text-sm font-medium text-uconn-navy hover:bg-uconn-navy/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-uconn-navy focus-visible:ring-offset-2"
          >
            Close
          </button>
        </div>

        <div className="mb-5 flex flex-wrap gap-2 text-sm text-zinc-700">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-medium">
            <span className="size-2.5 rounded-full bg-amber-500" />
            Breakfast
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 font-medium">
            <span className="size-2.5 rounded-full bg-sky-500" />
            Lunch
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 font-medium">
            <span className="size-2.5 rounded-full bg-violet-500" />
            Dinner
          </span>
        </div>

        {loading ? (
          <p className="mb-4 text-sm text-zinc-600">Loading availability...</p>
        ) : null}

        {requestError ? (
          <div
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            {requestError}
          </div>
        ) : null}

        {!loading && !requestError && availability && !hasResults ? (
          <p className="mb-4 text-sm text-zinc-600">
            This item is not available during this current week.
          </p>
        ) : null}

        <div className="availability-calendar rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3 md:p-4">
          <FullCalendar
            plugins={[dayGridPlugin]}
            initialView="dayGridWeek"
            initialDate={availability?.week_start}
            height="auto"
            events={events}
            fixedWeekCount={false}
            firstDay={1}
            dayMaxEventRows={false}
            expandRows
            eventContent={(eventInfo) => {
              const meal = String(eventInfo.event.extendedProps.meal ?? "");
              const diningHall = String(
                eventInfo.event.extendedProps.diningHall ?? "",
              );

              return (
                <div className="availability-event-inner">
                  <span className="availability-event-meal">{meal}</span>
                  <span className="availability-event-hall">{diningHall}</span>
                </div>
              );
            }}
            headerToolbar={{
              left: "title",
              right: "",
            }}
          />
        </div>
      </div>
    </div>
  );
}
