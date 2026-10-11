import { Link } from "react-router-dom";
import { CalendarClock, Compass, Plus, Route as RouteIcon, Sparkles } from "lucide-react";
import { useGarage } from "@/api/hooks";
import { EmptyState, ErrorBox, PageHeader, ProgressBar, Spinner } from "@/components/ui";
import { dateFmt, inr, inrRange } from "@/lib/format";
import { VehicleCard } from "./parts";

export default function Garage() {
  const { data, isLoading, error, refetch } = useGarage();
  if (isLoading) return <Spinner label="Opening your garage" />;
  if (error || !data) return <ErrorBox error={error} retry={() => refetch()} />;
  const { vehicles, total_equity: te, care_task: care, next_goal: goal, collection: col } = data;
  const current = vehicles.filter((v) => v.ownership === "current");
  const past = vehicles.filter((v) => v.ownership === "past");

  return (
    <>
      <PageHeader title="My Garage" sub="Your vehicles, what they're worth, and what needs doing next."
        action={<Link to="/garage/add" className="btn-go"><Plus className="h-5 w-5" aria-hidden /> Add vehicle</Link>} />

      {!vehicles.length ? (
        <EmptyState title="Your garage is empty" body="Add the vehicle you own, or explore the collection first. You can do either without sharing any financial details.">
          <Link to="/garage/add" className="btn-go"><Plus className="h-5 w-5" aria-hidden /> Add a vehicle</Link>
          <Link to="/explore" className="btn-ghost"><Compass className="h-5 w-5" aria-hidden /> Explore the collection</Link>
        </EmptyState>
      ) : (
        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <section aria-label="Vehicles" className="space-y-4">
            {te && (
              <div className="card bg-go-light/50">
                <p className="text-xs font-extrabold uppercase text-go-dark">Total estimated equity</p>
                <p className="text-3xl font-black text-go-dark">{inrRange(te.low, te.high)}</p>
                <p className="text-sm font-bold text-ink-soft">
                  Based on {te.counted} of {te.of} current vehicle{te.of > 1 ? "s" : ""} with a known loan balance and valuation. Private to you.
                </p>
              </div>
            )}
            {current.map((v) => <VehicleCard key={v.id} v={v} />)}
            {!!past.length && (
              <>
                <h2 className="pt-2 text-lg">Owned before</h2>
                {past.map((v) => <VehicleCard key={v.id} v={v} />)}
              </>
            )}
          </section>

          <aside className="space-y-4" aria-label="Summary">
            <div className="card">
              <h2 className="mb-2 flex items-center gap-2 text-base"><CalendarClock className="h-5 w-5 text-sun-dark" aria-hidden /> Care</h2>
              {care ? (
                <Link to={`/garage/${care.vehicle_id}`} className="block">
                  <p className="font-black">{care.kind}</p>
                  <p className="text-sm font-bold text-ink-soft">{care.vehicle} · {care.overdue ? "overdue since" : "due"} {dateFmt(care.due)}</p>
                </Link>
              ) : <p className="text-sm font-semibold text-ink-soft">Nothing due. Log a service on any vehicle to get a reminder date.</p>}
            </div>
            <div className="card">
              <h2 className="mb-2 flex items-center gap-2 text-base"><RouteIcon className="h-5 w-5 text-sky-dark" aria-hidden /> Next goal</h2>
              {goal ? (
                <Link to={`/roadmap/goal/${goal.id}`} className="block">
                  <p className="font-black">Road to {goal.label}</p>
                  <p className="text-sm font-bold text-ink-soft">Assuming {inr(goal.price_assumption)}{goal.target_date && ` · by ${dateFmt(goal.target_date)}`}</p>
                </Link>
              ) : <><p className="text-sm font-semibold text-ink-soft">No goal yet. Pick a vehicle you'd love and see a realistic route to it.</p><Link to="/roadmap" className="btn-ghost mt-3">Plan a Road-to</Link></>}
            </div>
            <div className="card">
              <h2 className="mb-2 flex items-center gap-2 text-base"><Sparkles className="h-5 w-5 text-ball" aria-hidden /> Collection</h2>
              <p className="mb-2 text-sm font-extrabold">{col.discovered} of {col.total} models discovered</p>
              <ProgressBar value={col.discovered} max={col.total} label="Collection progress" />
              <Link to="/explore" className="btn-ghost mt-3 w-full">Open the collection</Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
