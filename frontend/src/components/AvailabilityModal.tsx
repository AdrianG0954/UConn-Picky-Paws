import { AvailabilityCalendar  } from "./"

export function AvailabilityModal() {
  return (
    <>
      <div className="fixed inset-0 z-50 flex bg-black/50">
	<AvailabilityCalendar>
      </div>
    </>
  );
}
