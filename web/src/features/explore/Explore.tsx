import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Binoculars, CarFront, KeyRound, LayoutList, Network, Search } from "lucide-react";
import { api } from "@/api/client";
import { useCollection, useInvalidate, useMe, usePassport } from "@/api/hooks";
import type { CollectionModel } from "@/api/types";
import { Callout, cx, ErrorBox, PageHeader, ProgressBar, SegmentDot, Sheet, Spinner, useDebounced, useToast } from "@/components/ui";
import { VehicleImage } from "@/components/VehicleImage";
import { asOf, inr, shortInr } from "@/lib/format";
import { BadgeChips, isDiscovered, specLine } from "./parts";

const TYPES = [["", "All types"], ["scooter", "Scooters"], ["bike", "Bikes"], ["car", "Cars"]] as const;
const STATUS = [["", "Any status"], ["new", "Not discovered"], ["found", "Discovered"], ["saved", "Saved"], ["owned", "Owned"]] as const;
const BUDGET = [["", "Any budget"], ["1", "Under ₹1L"], ["2", "₹1L – 2L"], ["3", "₹2L – 5L"], ["4", "Above ₹5L"]] as const;
const inBudget = (m: CollectionModel, b: string) => !b || (b === "1" ? m.price_low < 1e5 : b === "2" ? m.price_low >= 1e5 && m.price_low < 2e5 : b === "3" ? m.price_low >= 2e5 && m.price_low < 5e5 : m.price_low >= 5e5);

export default function Explore() {
  const { data, isLoading, error, refetch } = useCollection();
  const { data: me } = useMe();
  const [view, setView] = useState<"tree" | "list">("tree");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [budget, setBudget] = useState("");
  const [make, setMake] = useState("");
  const [q, setQ] = useState("");
  const dq = useDebounced(q).toLowerCase();
  const [open, setOpen] = useState<CollectionModel | null>(null);

  const makes = useMemo(() => [...new Set((data?.models ?? []).map((m) => m.make))].sort(), [data]);
  const filtered = useMemo(() => (data?.models ?? []).filter((m) =>
    (!type || m.type === type) && (!make || m.make === make) && inBudget(m, budget) &&
    (!dq || `${m.make} ${m.model} ${m.variant}`.toLowerCase().includes(dq)) &&
    (!status || (status === "new" ? !isDiscovered(m.badges) : status === "found" ? isDiscovered(m.badges) : status === "saved" ? m.badges.includes("saved") : m.badges.includes("owned"))),
  ), [data, type, make, budget, dq, status]);

  if (isLoading) return <Spinner label="Unrolling the map" />;
  if (error || !data) return <ErrorBox error={error} retry={() => refetch()} />;
  const p = data.progress;

  return (
    <>
      <PageHeader title="Explore" sub="A collection by purpose, not by price. Discovering a model never costs anything, and nothing here touches credit."
        action={<div className="flex flex-wrap items-center gap-2">
          {!data.guest && <Link to="/dream" className="btn-ghost !min-h-[40px]">Dream Garage</Link>}
          <div role="group" aria-label="View" className="flex rounded-2xl border-2 border-ink/15 bg-white p-1">
            {([["tree", Network, "Tree"], ["list", LayoutList, "List"]] as const).map(([v, I, l]) => (
              <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={cx("flex min-h-[40px] items-center gap-2 rounded-xl px-4 font-extrabold", view === v ? "bg-ink text-white" : "text-ink-soft")}><I className="h-4 w-4" aria-hidden />{l}</button>
            ))}
          </div></div>} />

      {data.guest ? (
        <div className="mb-5"><Callout tone="info" title="Exploring as a guest">Browse everything. <Link className="font-extrabold underline" to="/signup" state={{ next: "/explore" }}>Create a free profile</Link> to spot, save and log models. No PAN or financial details needed.</Callout></div>
      ) : (
        <div className="card mb-5 grid items-center gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="font-black">{p.discovered} of {p.total} models discovered · {p.title}</p>
            <ProgressBar value={p.discovered} max={p.total} label="Models discovered" />
          </div>
          <p className="text-sm font-extrabold text-ink-soft">{p.xp} XP · Lv {p.level}</p>
        </div>
      )}

      <section aria-label="Filters" className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-mute" aria-hidden />
          <input aria-label="Search models" className="input pl-11" placeholder="Search model or make" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select label="Type" value={type} onChange={setType} opts={TYPES} />
        <Select label="Budget band" value={budget} onChange={setBudget} opts={BUDGET} />
        <Select label="Status" value={status} onChange={setStatus} opts={STATUS} />
        <Select label="Manufacturer" value={make} onChange={setMake} opts={[["", "All makes"], ...makes.map((m) => [m, m] as const)]} />
      </section>
      <p className="mb-4 text-sm font-bold text-ink-mute" role="status">{filtered.length} model{filtered.length === 1 ? "" : "s"}. Cost is a filter, not a measure of success. Prices are demo seed values.</p>

      {view === "tree" ? <Tree models={filtered} segments={data.segments} onOpen={setOpen} /> : <List models={filtered} onOpen={setOpen} />}
      <QuickView m={open} onClose={() => setOpen(null)} loggedIn={!!me} />
    </>
  );
}

function Select({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: readonly (readonly [string, string])[] }) {
  return <select aria-label={label} className="input" value={value} onChange={(e) => onChange(e.target.value)}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
}

/** Branches by purpose. Solid spine = already discovered, dashed = aspiration. Same data as the list view (the text alternative). */
function Tree({ models, segments, onOpen }: { models: CollectionModel[]; segments: { id: string; label: string }[]; onOpen: (m: CollectionModel) => void }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3" role="tree" aria-label="Collection tree by purpose">
      {segments.map((s) => {
        const items = models.filter((m) => m.segment === s.id).sort((a, b) => a.price_low - b.price_low);
        if (!items.length) return null;
        return (
          <section key={s.id} role="group" aria-labelledby={`seg-${s.id}`} className="card !p-4">
            <h2 id={`seg-${s.id}`} className="mb-3 flex items-center gap-2 text-lg"><SegmentDot segment={s.id} /> {s.label}
              <span className="ml-auto text-xs font-extrabold text-ink-mute">{items.filter((m) => isDiscovered(m.badges)).length}/{items.length}</span></h2>
            <ol className="relative">
              {items.map((m, i) => {
                const found = isDiscovered(m.badges);
                const nextFound = i < items.length - 1 && isDiscovered(items[i + 1].badges);
                return (
                  <li key={m.id} role="treeitem" aria-selected={found} className="relative pb-3 pl-20 last:pb-0">
                    {i < items.length - 1 && <span aria-hidden className={cx("absolute left-[28px] top-11 bottom-[-4px] w-0 border-l-[3px]", found && nextFound ? "border-solid border-ink/60" : "border-dashed border-ink/25")} />}
                    <button onClick={() => onOpen(m)} className="absolute left-0 top-0 rounded-full" aria-label={`Open ${m.label}`}>
                      <VehicleImage id={m.id} label={m.label} type={m.type} className="h-11 w-16 rounded-xl object-cover" />
                    </button>
                    <button onClick={() => onOpen(m)} className="block min-h-[44px] w-full text-left">
                      <span className={cx("block font-black leading-tight", !found && "text-ink-soft")}>{m.label}</span>
                      <span className="block text-xs font-bold text-ink-mute">{m.type} · from {shortInr(m.price_low)}</span>
                      <JourneySignals badges={m.badges} />
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
      {!models.length && <p className="col-span-full font-bold text-ink-soft">Nothing matches those filters.</p>}
    </div>
  );
}

function List({ models, onOpen }: { models: CollectionModel[]; onOpen: (m: CollectionModel) => void }) {
  return (
    <ul className="space-y-2.5">
      {models.map((m) => (
        <li key={m.id}>
          <button onClick={() => onOpen(m)} className="card flex min-h-[64px] w-full items-center gap-3 !p-3 text-left hover:border-go/60">
            <VehicleImage id={m.id} label={m.label} type={m.type} className="h-12 w-20 rounded-xl object-cover" />
            <span className="min-w-0 flex-1"><span className="block truncate font-black">{m.label}</span><span className="block text-xs font-bold text-ink-mute">{m.variant} · {m.type} · {m.segment} · from {shortInr(m.price_low)}</span><JourneySignals badges={m.badges} /></span>
            <span className="hidden sm:block"><BadgeChips badges={m.badges} size="xs" /></span>
          </button>
        </li>
      ))}
      {!models.length && <p className="font-bold text-ink-soft">Nothing matches those filters.</p>}
    </ul>
  );
}

/** The two fastest-to-scan journey signals stay visible in both Explore layouts. */
function JourneySignals({ badges }: { badges: string[] }) {
  const signals = badges.filter((badge) => badge === "spotted" || badge === "driven");
  return signals.length ? <span className="mt-1 block"><BadgeChips badges={signals} size="xs" /></span> : null;
}

function QuickView({ m, onClose, loggedIn }: { m: CollectionModel | null; onClose: () => void; loggedIn: boolean }) {
  const nav = useNavigate();
  const toast = useToast();
  const inv = useInvalidate();
  const { data: passport, isLoading: passportLoading } = usePassport(m?.id ?? "");
  const act = useMutation({
    mutationFn: (activity: string) => api<{ duplicate: boolean; xp_awarded: number }>("/activities", { body: { model_id: m!.id, activity } }),
    onSuccess: (r, a) => {
      inv("collection", "me", "garage", "dream");
      toast(r.duplicate ? "Already logged. Repeat logs don't earn XP." : a === "saved" ? "Saved to your Dream Garage" : `Discovered! +${r.xp_awarded} XP`);
      onClose();
    },
  });
  const go = (activity: string) => (loggedIn ? act.mutate(activity) : nav("/signup", { state: { next: "/explore", reason: "Create a free profile to log your vehicle experiences." } }));
  const bought = () => loggedIn
    ? nav("/garage/add", { state: { model: m } })
    : nav("/signup", { state: { next: "/explore", reason: "Create a free profile to add a vehicle to your garage." } });
  const badges = passport?.badges ?? m?.badges ?? [];
  return (
    <Sheet open={!!m} onOpenChange={(o) => !o && onClose()} title={m?.label ?? ""} description={m ? `${m.variant} · ${m.segment}` : undefined}>
      {m && (
        <div className="space-y-4">
          <div className="flex items-center gap-4"><VehicleImage id={m.id} label={m.label} type={m.type} className="h-20 w-28 rounded-2xl object-cover" />
            <div><p className="text-lg font-black">{shortInr(m.price_low)} – {shortInr(m.price_high)}</p><p className="text-xs font-bold text-ink-mute">Ex-showroom range · {m.source} · as of {m.as_of}</p></div></div>
          <p className="font-semibold text-ink-soft">{specLine(m.specs)}</p>
          <BadgeChips badges={badges} />
          {passportLoading ? <p className="help">Loading vehicle details…</p> : passport && <>
            <section className="rounded-2xl bg-mint/55 p-3"><p className="text-xs font-extrabold uppercase text-go-dark">Why it might fit</p><p className="mt-1 text-sm font-semibold text-ink-soft">{passport.fit.reason}</p></section>
            <section className="rounded-2xl border-2 border-ink/10 p-3"><p className="text-sm font-extrabold">Illustrative running cost</p><div className="mt-2 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs font-bold uppercase text-ink-mute">Fuel / charge yearly</p><p className="font-black">{passport.ownership_cost.yearly_running != null ? inr(passport.ownership_cost.yearly_running) : "Unavailable"}</p></div><div><p className="text-xs font-bold uppercase text-ink-mute">Insurance yearly</p><p className="font-black">{inr(passport.ownership_cost.yearly_insurance)}</p></div></div><p className="mt-2 text-xs font-semibold text-ink-mute">{passport.ownership_cost.assumptions.join(" · ")}</p></section>
            <p className="text-xs font-bold text-ink-mute">Source: {passport.model.source} · {asOf(passport.model.as_of)}</p>
          </>}
          <section aria-label="What happened with this vehicle">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-ink-mute">Add to your journey</p>
            <div className="grid grid-cols-2 gap-2.5">
              <button className="btn-go !justify-start" disabled={act.isPending || badges.includes("spotted")} onClick={() => go("spotted")}><Binoculars className="h-4 w-4" aria-hidden />{badges.includes("spotted") ? "Spotted ✓" : "Spotted"}</button>
              <button className="btn-ghost !justify-start" disabled={act.isPending || badges.includes("driven")} onClick={() => go("driven")}><CarFront className="h-4 w-4" aria-hidden />{badges.includes("driven") ? "Drove ✓" : "Drove"}</button>
              <button className="btn-ghost !justify-start" disabled={act.isPending || badges.includes("rented")} onClick={() => go("rented")}><KeyRound className="h-4 w-4" aria-hidden />{badges.includes("rented") ? "Rented ✓" : "Rented"}</button>
              <button className="btn-ghost !justify-start" onClick={bought}><KeyRound className="h-4 w-4" aria-hidden />{badges.includes("owned") ? "In garage ✓" : "Bought"}</button>
            </div>
          </section>
          <p className="text-center text-xs font-semibold text-ink-mute">Spotted and Drove appear as signals on your Explore cards. Bought opens a prefilled Garage entry.</p>
        </div>
      )}
    </Sheet>
  );
}
