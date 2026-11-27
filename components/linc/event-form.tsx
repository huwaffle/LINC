import { createEvent } from "@/app/actions/social";

/** Event form for publishing USC events. */
export function EventForm() {
  return (
    <form action={createEvent} className="mt-4 space-y-4">
          <div>
            <label htmlFor="title" className="block text-[12px] font-semibold text-neutral-500">
              Event title
            </label>
            <input
              id="title"
              name="title"
              required
              minLength={6}
              placeholder="CAST Week opening ceremony"
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-[15px] text-ink placeholder:text-neutral-400 outline-none transition focus:border-linc-400 focus:ring-4 focus:ring-linc-50"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="startsAt" className="block text-[12px] font-semibold text-neutral-500">
                Date and time
              </label>
              <input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                required
                className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none transition focus:border-linc-400 focus:ring-4 focus:ring-linc-50"
              />
            </div>
            <div>
              <label htmlFor="location" className="block text-[12px] font-semibold text-neutral-500">
                Location
              </label>
              <input
                id="location"
                name="location"
                required
                placeholder="University Auditorium"
                className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-[14px] text-ink placeholder:text-neutral-400 outline-none transition focus:border-linc-400 focus:ring-4 focus:ring-linc-50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-[12px] font-semibold text-neutral-500">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              required
              minLength={20}
              rows={5}
              placeholder="What happens at the event, who can join, and what students should bring."
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-[14px] leading-relaxed text-ink placeholder:text-neutral-400 outline-none transition focus:border-linc-400 focus:ring-4 focus:ring-linc-50"
            />
          </div>

          <div>
            <label
              htmlFor="registrationUrl"
              className="block text-[12px] font-semibold text-neutral-500"
            >
              Registration link <span className="font-normal text-neutral-400">(optional)</span>
            </label>
            <input
              id="registrationUrl"
              name="registrationUrl"
              type="url"
              placeholder="https://forms.example.com/…"
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-[14px] text-ink placeholder:text-neutral-400 outline-none transition focus:border-linc-400 focus:ring-4 focus:ring-linc-50"
            />
          </div>

          <div className="flex justify-end border-t border-line pt-4">
            <button
              type="submit"
              className="rounded-full bg-linc-600 px-5 py-2 text-[14px] font-semibold text-white transition hover:bg-linc-700"
            >
              Publish event
            </button>
          </div>
        </form>
  );
}
