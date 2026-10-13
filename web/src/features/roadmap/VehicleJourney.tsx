import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useGoals, useInvalidate, useMe, usePassport } from "@/api/hooks";
import { ErrorBox, Sheet, Spinner, useToast } from "@/components/ui";
import { VehicleImage } from "@/components/VehicleImage";
import { shortInr } from "@/lib/format";

const ROUTES = [["test_drive", "Test drive"], ["short_rental", "Short-term rental"], ["long_rental", "Long-term rental"], ["own", "Own"]] as const;
export type JourneyRoute = typeof ROUTES[number][0];

export function VehicleJourney({ modelId, onClose, initialRoute = null }: { modelId: string | null; onClose: () => void; initialRoute?: JourneyRoute | null }) {
  const { data, isLoading, error } = usePassport(modelId ?? "");
  const { data: me } = useMe();
  const { data: goals } = useGoals();
  const [route, setRoute] = useState<JourneyRoute | null>(initialRoute);
  const nav = useNavigate();
  const inv = useInvalidate();
  const toast = useToast();
  const log = useMutation({
    mutationFn: (activity: string) => api("/activities", { body: { model_id: modelId, activity } }),
    onSuccess: () => { inv("passport", "collection", "garage", "me", "dream"); toast("Progress saved"); },
  });
  const own = useMutation({
    mutationFn: async () => goals?.items.find(g => g.target_model?.id === modelId) ?? api<{ id: string }>("/goals", { body: { target_model_id: modelId, savings: data ? Math.round(((data.model.price_low + data.model.price_high) / 2) * .2) : 0 } }),
    onSuccess: g => { inv("goals", "garage"); onClose(); nav(`/ownership/${g.id}`); },
  });
  useEffect(() => {
    if (initialRoute && me && modelId) log.mutate(`intent_${initialRoute}`);
  }, [initialRoute, me?.id, modelId]); // Persist inline Explore selections separately from completed experiences.
  const choose = (r: JourneyRoute) => {
    if (!me) { nav("/signup", { state: { next: `/explore?model=${modelId}` } }); return; }
    setRoute(r); log.mutate(`intent_${r}`);
    if (r === "own") own.mutate();
  };
  const doneKey = route === "test_drive" ? "test_driven" : route;
  const badges = data?.badges ?? [];
  const rentalHref = data?.model.type === "car" ? "https://www.zoomcar.com/in/bangalore" : route === "long_rental" ? "https://www.royalbrothers.com/long-term/search?city=bangalore&city_id=1" : "https://www.royalbrothers.com/bangalore/bike-rentals";
  const dealerHref = `https://www.google.com/maps/search/${encodeURIComponent(`${data?.model.make ?? ""} showroom Bengaluru test drive`)}`;
  return <Sheet open={!!modelId} onOpenChange={o => { if (!o) { setRoute(null); onClose(); } }} title={data?.model.label ?? "Explore this vehicle"}>
    {isLoading ? <Spinner /> : error ? <ErrorBox error={error} /> : data && <div className="space-y-4">
      <VehicleImage id={data.model.id} label={data.model.label} type={data.model.type} priority className="h-48 w-full rounded-2xl object-cover" />
      <p className="font-bold">{shortInr(data.model.price_low)} – {shortInr(data.model.price_high)} · catalogue estimate</p>
      <p className="text-sm text-ink-soft">{data.fit.reason}</p>
      <div className="grid grid-cols-2 gap-2">{ROUTES.map(([r, label]) => <button key={r} className="btn-ghost" aria-pressed={route === r} disabled={log.isPending || own.isPending} onClick={() => choose(r)}>{label}{badges.includes(r === "test_drive" ? "test_driven" : r === "own" ? "owned" : r) ? " ✓" : ""}</button>)}</div>
      {route && route !== "own" && <section className="card space-y-3">
        <h2>{ROUTES.find(([r]) => r === route)?.[1]} · Bengaluru</h2>
        <a className="btn-go" href={route === "test_drive" ? dealerHref : rentalHref} target="_blank" rel="noreferrer">{route === "test_drive" ? "Find a showroom" : "Check Bangalore rental options"} ↗</a>
        <p className="help">{route === "test_drive" ? "Arrange a test drive with the showroom." : "Booking, model availability and pricing are confirmed by the provider. Moto Go has no booking integration or commercial partnership yet."}</p>
        <button className="btn-ghost w-full" disabled={log.isPending || badges.includes(doneKey ?? "")} onClick={() => doneKey && log.mutate(doneKey)}>{badges.includes(doneKey ?? "") ? "Completed ✓" : `I've completed this · +${route === "test_drive" ? 250 : 500} points`}</button>
        <p className="help">Completion is self-reported. Opening a provider does not mark an experience complete.</p>
      </section>}
      {badges.includes("test_driven") && <p className="text-sm font-bold text-go-dark">You've tried this vehicle. If it felt right, explore what ownership could look like.</p>}
      <div className="flex flex-wrap gap-2"><button className="btn-ghost" disabled={log.isPending || badges.includes("saved")} onClick={() => me ? log.mutate("saved") : choose("own")}>{badges.includes("saved") ? "In Dream Garage ✓" : "Save to Dream Garage"}</button><button className="btn-go" disabled={own.isPending || log.isPending} onClick={() => choose("own")}>Explore financing</button></div>
      {(log.error || own.error) && <ErrorBox error={log.error || own.error} />}
      <Link to="/garage" className="btn-quiet">Back to Garage</Link>
    </div>}
  </Sheet>;
}
