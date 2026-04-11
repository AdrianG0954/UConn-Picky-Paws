import dayGridPlugin from "@fullcalendar/daygrid";
import FullCalendar from "@fullcalendar/react";

const mockEvents = [
  {
    title: "Lunch",
    date: "2026-04-06",
    extendedProps: {
      description: "McMahon",
    },
  },
  {
    title: "Dinner",
    date: "2026-04-08",
    extendedProps: {
      description: "South",
    },
  },
];

type Props = {
  isAvailabilityModalOpen: boolean;
  setIsAvailabilityModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function AvailabilityModal({
  isAvailabilityModalOpen,
  setIsAvailabilityModalOpen,
}: Props) {
  if (!isAvailabilityModalOpen) {
    return null;
  } else {
    return (
      <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <FullCalendar
              plugins={[dayGridPlugin]}
              initialView="dayGridWeek"
              height={300}
              events={mockEvents}
              customButtons={{
                closeButton: {
                  //TODO handle modal close
                  text: "Close",
                  click: () => setIsAvailabilityModalOpen(false),
                },
              }}
              headerToolbar={{
                left: "title",
                right: "prev,next closeButton",
              }}
            />
          </div>
        </div>
      </>
    );
  }
}
