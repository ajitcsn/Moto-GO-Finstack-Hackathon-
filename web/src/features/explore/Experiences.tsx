import { Link, useSearchParams } from "react-router-dom";
import { CalendarCheck, ExternalLink, Info } from "lucide-react";
import { usePassport } from "@/api/hooks";
import { Callout, PageHeader } from "@/components/ui";

/** E01 as a static partner-handoff screen. No bookings are invented. */
export default function Experiences() {
  const [sp] = useSearchParams();
  const model = sp.get("model");
  const { data } = usePassport(model ?? "");
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Try it first" sub={model && data ? `Test ride or rent the ${data.model.label} before you decide.` : "Test rides and weekend rentals, through partners."} />
      <Callout tone="warn" title="Bookings aren't live in this demo">Inventory and booking come from separate partnerships. When they're connected you'll be handed to the partner's page with the vehicle and city filled in. We won't show a booking confirmation unless a partner sends one.</Callout>
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 text-lg"><CalendarCheck className="h-5 w-5 text-go-dark" aria-hidden /> What to expect from a partner</h2>
        <ul className="list-disc space-y-1 pl-5 font-semibold text-ink-soft">
          <li>Availability, price and deposit shown before you commit.</li>
          <li>Rental inclusions, damage excess, insurance and cancellation spelled out.</li>
          <li>Eligibility (licence, age) stated up front.</li>
          <li>No XP for spending on a rental: experience badges are earned by logging the experience.</li>
        </ul>
        <button className="btn-ghost" disabled><ExternalLink className="h-4 w-4" aria-hidden /> Continue to partner (not connected)</button>
      </section>
      <section className="card flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-dark" aria-hidden />
        <p className="font-semibold text-ink-soft">Already did a test ride or rental elsewhere? Log it on the vehicle's passport as a self-reported experience.
          {model && <> <Link to={`/explore/${model}`} className="font-extrabold text-sky-dark underline">Open passport</Link>.</>}</p></section>
    </div>
  );
}
