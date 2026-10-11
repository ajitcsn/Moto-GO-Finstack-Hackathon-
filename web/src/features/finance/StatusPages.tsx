import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Check, Circle, Loader2, Truck } from "lucide-react";
import { useApplication, useApplicationStream, useTimeline } from "@/api/hooks";
import { Callout, cx, ErrorBox, Spinner } from "@/components/ui";
import { inr } from "@/lib/format";
import { FinanceFrame, STATE_LABEL } from "./Frame";

/** Router: send the user to wherever the application actually is. */
export function FinanceRouter() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { data: app, error, refetch, isFetching } = useApplication(id, true);
  useEffect(() => {
    if (!app || isFetching) return;
    const s = app.current_step;
    const to = ["remediation", "status", "offers", "disbursal", "handoff", "recovery"].includes(s) ? `/finance/${id}/${s}` : `/finance/${id}/step/${s}`;
    nav(to, { replace: true });
  }, [app, id, nav, isFetching]);
  if (error) return <FinanceFrame><ErrorBox error={error} retry={() => refetch()} /></FinanceFrame>;
  return <FinanceFrame><Spinner label="Finding where you left off" /></FinanceFrame>;
}

export function ReturnPage() {
  const { id = "" } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { data: app, refetch } = useApplication(id);
  useEffect(() => { refetch().then(() => nav(`/finance/${id}`, { replace: true })); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return <FinanceFrame app={app}><Spinner label={`Welcome back from ${sp.get("step") === "esign" ? "signing" : "your bank link"}`} /></FinanceFrame>;
}

const TIMELINE_STATES = ["consented", "identity_pending", "evidence_pending", "underwriting", "offered"];

/** F10: status timeline. Pending is not rejected. */
export function Status() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { data: app, error, refetch } = useApplication(id);
  const { data: tl } = useTimeline(id);
  useApplicationStream(id);
  useEffect(() => {
    if (!app) return;
    if (app.current_step !== "status") nav(`/finance/${id}`, { replace: true });
  }, [app, id, nav]);
  if (error) return <FinanceFrame><ErrorBox error={error} retry={() => refetch()} /></FinanceFrame>;
  if (!app) return <FinanceFrame><Spinner /></FinanceFrame>;
  const reviewing = app.state === "underwriting";
  return (
    <FinanceFrame app={app} stage="status">
      <div className="space-y-5">
        <div className="card space-y-3 text-center">
          {reviewing && <Loader2 className="mx-auto h-10 w-10 animate-spin text-go-dark" aria-hidden />}
          <h1 className="text-2xl sm:text-3xl">{reviewing ? `${app.lender.name} is reviewing` : STATE_LABEL[app.state]}</h1>
          <p className="mx-auto max-w-md font-semibold text-ink-soft">
            {reviewing ? "This usually takes a moment here, and longer with real lenders. Pending is not a rejection, and there's nothing you need to do. You can leave and come back; we'll show the result here."
              : "Hang on while we update your status."}
          </p>
        </div>
        <section className="card" aria-label="Status timeline">
          <h2 className="mb-3 text-lg">What's happened</h2>
          <ol className="space-y-3">
            {(tl?.items ?? []).map((e, i, a) => {
              const last = i === a.length - 1;
              return (
                <li key={e.id} className="flex gap-3">
                  {last && reviewing ? <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-sky-dark" aria-hidden /> : <Check className="mt-0.5 h-5 w-5 shrink-0 text-go-dark" aria-hidden />}
                  <div><p className="font-extrabold">{e.summary}</p><p className="text-xs font-bold text-ink-mute">{new Date(e.at + "Z").toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}{e.provider && ` · ${e.provider}`}</p></div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </FinanceFrame>
  );
}

const DISB = [
  ["Agreement signed", ["signed", "disbursal_pending", "disbursed"]],
  ["Lender pays the dealer", ["disbursed"]],
  ["Vehicle delivered to you", []],
] as const;

/** F16: disbursal status. An offer is not disbursal, and disbursal is not delivery. */
export function Disbursal() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { data: app, error, refetch } = useApplication(id);
  useApplicationStream(id);
  useEffect(() => { if (app?.state === "disbursed") nav(`/finance/${id}/handoff`, { replace: true }); }, [app, id, nav]);
  if (error) return <FinanceFrame><ErrorBox error={error} retry={() => refetch()} /></FinanceFrame>;
  if (!app) return <FinanceFrame><Spinner /></FinanceFrame>;
  return (
    <FinanceFrame app={app} stage="disbursal">
      <div className="space-y-5">
        <h1 className="text-2xl sm:text-3xl">You're signed. The lender is paying the dealer.</h1>
        <section className="card"><ol className="space-y-4">
          {DISB.map(([label, done], i) => {
            const isDone = (done as readonly string[]).includes(app.state);
            const active = !isDone && (i === 0 || (DISB[i - 1][1] as readonly string[]).includes(app.state));
            return (
              <li key={label} className="flex items-center gap-3">
                {isDone ? <Check className="h-6 w-6 rounded-full bg-go p-1 text-white" aria-hidden /> : active ? <Loader2 className="h-6 w-6 animate-spin text-sky-dark" aria-hidden /> : <Circle className="h-6 w-6 text-ink/30" aria-hidden />}
                <span className={cx("text-lg font-extrabold", !isDone && !active && "text-ink-mute")}>{label}</span>
              </li>);
          })}
        </ol></section>
        <Callout>Funds go directly from {app.lender.name} to the dealer. Moto Go never holds your money. Your first EMI date and amount are in your signed agreement.</Callout>
      </div>
    </FinanceFrame>
  );
}

/** F17: garage handoff. */
export function Handoff() {
  const { id = "" } = useParams();
  const { data: app, error, refetch } = useApplication(id);
  if (error) return <FinanceFrame><ErrorBox error={error} retry={() => refetch()} /></FinanceFrame>;
  if (!app) return <FinanceFrame><Spinner /></FinanceFrame>;
  return (
    <FinanceFrame app={app} stage="handoff">
      <div className="mx-auto max-w-lg space-y-5 text-center">
        <div className="card animate-pop space-y-3 !p-8">
          <Truck className="mx-auto h-12 w-12 text-sky-dark" aria-hidden />
          <h1 className="text-2xl sm:text-3xl">Paid to the dealer</h1>
          <p className="font-semibold text-ink-soft">Your {app.model?.label} is in your Garage, marked <b>delivery pending</b> with a {inr(app.amount)} loan from {app.lender.name}. Disbursal isn't delivery: mark it delivered when you have it.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            {app.vehicle_id && <Link to={`/garage/${app.vehicle_id}`} className="btn-go">See it in my Garage</Link>}
            <Link to="/garage" className="btn-ghost">Go to Garage</Link>
          </div>
        </div>
        <p className="text-sm font-bold text-ink-mute">Borrowing earns no XP, streaks or rewards. Your collection grows from discovering and caring for vehicles.</p>
      </div>
    </FinanceFrame>
  );
}
