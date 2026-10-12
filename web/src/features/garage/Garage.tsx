import { Link } from "react-router-dom";
import { CalendarClock, Compass, Plus, Route as RouteIcon, Sparkles } from "lucide-react";
import { useGarage } from "@/api/hooks";
import { EmptyState, ErrorBox, PageHeader, ProgressBar, Spinner } from "@/components/ui";
import { dateFmt, inr, inrRange } from "@/lib/format";
import { VehicleCard } from "./parts";
import { VehicleImage } from "@/components/VehicleImage";

export default function Garage() {
  const { data, isLoading, error, refetch } = useGarage();
  if (isLoading) return <Spinner label="Opening your garage" />;
  if (error || !data) return <ErrorBox error={error} retry={() => refetch()} />;
  const { vehicles, total_equity: te, care_task: care, next_goal: goal, suggestions, collection: col } = data;
  const current = vehicles.filter((v) => v.ownership === "current");
  const past = vehicles.filter((v) => v.ownership === "past");
  const fleetMix = (["car", "bike", "scooter"] as const).flatMap((type) => {
    const count = current.filter((v) => v.type === type).length;
    return count ? `${count} ${type}${count === 1 ? "" : "s"}` : [];
  }).join(" · ");

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
            {current.length === 1 && current[0] && (
              <Link to={`/garage/${current[0].id}`} className="group relative block min-h-[280px] overflow-hidden rounded-3xl bg-ink shadow-chunk">
                <VehicleImage id={current[0].model?.id} label={current[0].label} type={current[0].type} priority className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/65 to-transparent p-6 pt-20 text-white">
                  <p className="text-sm font-extrabold uppercase tracking-wide text-sun-light">Your ride</p>
                  <h2 className="text-3xl font-black">{current[0].label}</h2>
                  <p className="mt-1 font-bold text-white/80">Value, care and your next move—at a glance.</p>
                </div>
              </Link>
            )}
            {current.length > 1 && (
              <section className="card overflow-hidden bg-ink !p-0 text-white" aria-label="Your vehicle fleet">
                <div className="p-5 pb-3">
                  <p className="text-sm font-extrabold uppercase tracking-wide text-sun-light">Your garage</p>
                  <h2 className="text-2xl font-black">{current.length} current vehicles</h2>
                  <p className="font-bold text-white/75">{fleetMix} · each vehicle keeps its own value, care and loan details.</p>
                </div>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {current.slice(0, 3).map((v) => (
                    <Link key={v.id} to={`/garage/${v.id}`} className="group relative min-h-32 overflow-hidden bg-ink">
                      <VehicleImage id={v.model?.id} label={v.label} type={v.type} priority className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink to-transparent px-3 pb-2 pt-10 text-sm font-black">{v.label}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {te && (
              <div className="card bg-go-light/50">
                <p className="text-xs font-extrabold uppercase text-go-dark">Total estimated equity</p>
                <p className="text-3xl font-black text-go-dark">{inrRange(te.low, te.high)}</p>
                <p className="text-sm font-bold text-ink-soft">
                  Based on {te.counted} of {te.of} current vehicle{te.of > 1 ? "s" : ""} with a known loan balance and valuation. Private to you.
                </p>
              </div>
            )}
            {!!current.length && <h2 className="pt-1 text-lg">Current vehicles ({current.length})</h2>}
            <div className="grid gap-4 xl:grid-cols-2">{current.map((v) => <VehicleCard key={v.id} v={v} />)}</div>
            {!!past.length && (
              <>
                <h2 className="pt-2 text-lg">Owned before ({past.length})</h2>
                <div className="grid gap-4 xl:grid-cols-2">{past.map((v) => <VehicleCard key={v.id} v={v} />)}</div>
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
              <h2 className="mb-2 flex items-center gap-2 text-base"><RouteIcon className="h-5 w-5 text-sky-dark" aria-hidden /> {goal ? "Next goal" : "Suggestions"}</h2>
              {goal ? (
                <Link to={`/roadmap/goal/${goal.id}`} className="block">
                  <p className="font-black">Road to {goal.label}</p>
                  <p className="text-sm font-bold text-ink-soft">Assuming {inr(goal.price_assumption)}{goal.target_date && ` · by ${dateFmt(goal.target_date)}`}</p>
                </Link>
              ) : suggestions[0] ? <>
                <Link to="/roadmap" className="flex items-center gap-3 rounded-2xl bg-mint/55 p-3 transition hover:bg-mint">
                  <VehicleImage id={suggestions[0].id} label={suggestions[0].label} type={suggestions[0].type} className="h-14 w-20 rounded-xl object-cover" />
                  <span className="min-w-0"><span className="block text-sm font-bold text-ink-soft">{current.length > 1 ? "Based on your current garage" : `People with a ${current[0]?.type ?? "vehicle"} like yours often enjoy`}</span><span className="block truncate font-black">{suggestions[0].label}</span></span>
                </Link>
                <Link to={`/experiences?model=${suggestions[0].id}`} className="btn-go mt-3 w-full">Book a rental or test drive now</Link>
              </> : <><p className="text-sm font-semibold text-ink-soft">Pick a vehicle you'd love and see a realistic route to it.</p><Link to="/roadmap" className="btn-ghost mt-3">Explore suggestions</Link></>}
            </div>
            <div className="card">
              <h2 className="mb-2 flex items-center gap-2 text-base"><Sparkles className="h-5 w-5 text-coral" aria-hidden /> Collection</h2>
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
