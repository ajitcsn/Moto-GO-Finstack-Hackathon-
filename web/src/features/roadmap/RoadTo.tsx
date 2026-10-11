import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { api } from "@/api/client";
import { useGarage, useGoals, useInvalidate, useScenarios } from "@/api/hooks";
import type { Scenario } from "@/api/types";
import { Callout, cx, Disc, ErrorBox, PageHeader, Spinner, useDebounced, useToast } from "@/components/ui";
import { dateFmt, inr, inrRange, SEGMENT_COLOR, shortInr } from "@/lib/format";

const num = (s: string) => (s === "" ? 0 : Number(s.replace(/\D/g, "")));

export default function RoadTo() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const inv = useInvalidate();
  const { data: goals, isLoading } = useGoals();
  const { data: garage } = useGarage();
  const goal = goals?.items.find((g) => g.id === id);

  const [price, setPrice] = useState("");
  const [savings, setSavings] = useState("");
  const [monthly, setMonthly] = useState("");
  const [date, setDate] = useState("");
  const [costs, setCosts] = useState("0");
  const [rate, setRate] = useState("11.5");
  const [sellId, setSellId] = useState("");
  const [sell, setSell] = useState(false);
  useEffect(() => {
    if (!goal) return;
    setPrice(String(goal.price_assumption)); setSavings(String(goal.savings)); setMonthly(String(goal.monthly));
    setDate(goal.target_date ?? ""); setSellId(goal.sell_current ?? ""); setSell(!!goal.sell_current);
  }, [goal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const body = useDebounced({ price: num(price), savings: num(savings), monthly: num(monthly), acquisition_costs: num(costs), rate_pct: Number(rate) || 0, sell: sell && !!sellId }, 300);
  const { data: res, isFetching, error } = useScenarios(goal && price ? goal.id : undefined, body);

  const save = useMutation({
    mutationFn: () => api(`/goals/${id}`, { method: "PATCH", body: { price_assumption: num(price), savings: num(savings), monthly: num(monthly), target_date: date || null, sell_current: sell ? sellId || null : null } }),
    onSuccess: () => { inv("goals", "garage"); toast("Plan saved"); },
  });

  if (isLoading) return <Spinner />;
  if (!goal) return <ErrorBox error={new Error("not found")} />;
  const current = (garage?.vehicles ?? []).filter((v) => v.ownership === "current");
  const m = goal.target_model!;

  return (
    <>
      <PageHeader back={<Link to="/roadmap" className="mb-2 inline-flex items-center gap-1 text-sm font-extrabold text-ink-soft"><ArrowLeft className="h-4 w-4" /> Roadmap</Link>}
        title={<span className="flex items-center gap-3"><Disc color={SEGMENT_COLOR[m.segment]} size={40} />Road to {m.label}</span>}
        sub={`Ex-showroom ${shortInr(m.price_low)} – ${shortInr(m.price_high)} (${m.source}). Set your own on-road price below.`} />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <section className="card h-fit space-y-4" aria-label="Your assumptions">
          <h2 className="text-lg">Your numbers</h2>
          <Money id="price" label="On-road price I'm assuming" v={price} on={setPrice} />
          <Money id="savings" label="Savings I can put in" v={savings} on={setSavings} />
          <Money id="monthly" label="I can save each month" v={monthly} on={setMonthly} />
          <Money id="costs" label="Other acquisition costs (insurance, registration)" v={costs} on={setCosts} />
          <div><label className="label" htmlFor="tdate">Target date (optional)</label><input id="tdate" type="date" className="input" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label className="label" htmlFor="rate">Illustrative loan rate (% a year)</label><input id="rate" className="input" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))} /></div>
          {!!current.length && (
            <div className="space-y-2 rounded-2xl bg-mint p-3">
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 font-bold"><input type="checkbox" className="h-5 w-5 accent-go" checked={sell} onChange={(e) => { setSell(e.target.checked); if (e.target.checked && !sellId) setSellId(current[0].id); }} /> I'd sell a vehicle I own</label>
              {sell && <select aria-label="Vehicle to sell" className="input" value={sellId} onChange={(e) => setSellId(e.target.value)}>{current.map((v) => <option key={v.id} value={v.id}>{v.label} ({v.year})</option>)}</select>}
            </div>
          )}
          <button className="btn-ghost w-full" onClick={() => save.mutate()} disabled={save.isPending}>Save this plan</button>
        </section>

        <section aria-label="Scenarios" aria-busy={isFetching} className="space-y-4">
          {error ? <ErrorBox error={error} /> : !res ? <Spinner label="Working it out" /> : (
            <>
              <p className="font-bold text-ink-soft">Total to fund: <b className="text-ink">{inr(res.total_need)}</b>. Four routes, side by side. {res.demo_note}</p>
              {res.sell_vehicle && (
                <Callout tone={res.sell_vehicle.equity.negative ? "warn" : "info"} title={`If you sell ${res.sell_vehicle.label}`}>
                  {res.sell_vehicle.equity.known ? <>Estimated equity {inrRange(res.sell_vehicle.equity.low, res.sell_vehicle.equity.high)}. {res.sell_vehicle.equity.negative && "Negative equity counts as extra funding you'd need."}</>
                    : "Equity is unknown because the loan balance isn't known, so the sell route can't be calculated yet. Add your loan details in the Garage."}
                </Callout>)}
              {res.scenarios.map((s) => <ScenarioCard key={s.id} s={s} />)}
              <div className="card border-go/40 bg-go-light/30">
                <h2 className="text-lg">Want to see real lender offers?</h2>
                <p className="mb-3 mt-1 font-semibold text-ink-soft">Financing is a separate, optional application with a named lender. You'd see who and why before anything sensitive is collected, and the lender makes the decision. Your garage and plans are unaffected either way.</p>
                <button className="btn-go" onClick={() => nav(`/finance/start?goal=${goal.id}`)}>Explore financing <ArrowRight className="h-5 w-5" aria-hidden /></button>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function Money({ id, label, v, on }: { id: string; label: string; v: string; on: (s: string) => void }) {
  return (
    <div><label className="label" htmlFor={id}>{label}</label>
      <div className="relative"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-black text-ink-mute" aria-hidden>₹</span>
        <input id={id} className="input pl-9" inputMode="numeric" value={v === "" ? "" : Number(v).toLocaleString("en-IN")} onChange={(e) => on(e.target.value.replace(/\D/g, ""))} /></div></div>
  );
}

function ScenarioCard({ s }: { s: Scenario }) {
  return (
    <details className={cx("card group", s.unavailable && "opacity-70")} open={!s.unavailable}>
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3">
        <span className="text-lg font-black">{s.title}</span>
        <span className="text-right text-sm font-extrabold text-ink-soft">
          {s.unavailable ? "Not enough information" :
            s.id === "finance" ? (s.loan ? `Borrow ${inr(s.loan)}` : "No loan needed") :
            s.gap === 0 ? "Covered" : `Gap ${inr(s.gap)}${s.months != null ? ` · ${s.months} mo` : ""}`}
        </span>
      </summary>
      <div className="mt-3 space-y-3">
        <p className="font-semibold text-ink-soft">{s.summary}</p>
        {s.id === "finance" && !!s.options?.length && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-left text-sm">
              <caption className="sr-only">Illustrative EMI by tenure</caption>
              <thead><tr className="text-xs uppercase text-ink-mute"><th scope="col" className="py-1">Tenure</th><th scope="col">EMI</th><th scope="col">Interest paid</th></tr></thead>
              <tbody>{s.options.map((o) => <tr key={o.tenure} className="border-t border-ink/10 font-bold"><th scope="row" className="py-2">{o.tenure} months</th><td>{inr(o.emi)}</td><td>{inr(o.interest)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {s.id === "save" && s.months != null && s.months > 0 && <p className="font-bold">About {s.months} months, around {dateFmt(new Date(Date.now() + s.months * 30.4 * 864e5).toISOString())}.</p>}
        {s.id === "sell_buy" && s.proceeds != null && <p className="font-bold">Estimated proceeds: {inr(s.proceeds)}</p>}
        {!!s.assumptions.length && (
          <div><p className="text-xs font-extrabold uppercase text-ink-mute">Assumptions</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm font-semibold text-ink-soft">{s.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></div>
        )}
      </div>
    </details>
  );
}
