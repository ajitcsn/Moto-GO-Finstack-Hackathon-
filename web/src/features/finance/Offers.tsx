import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Clock } from "lucide-react";
import { api, ApiError } from "@/api/client";
import { useApplication, useApplicationStream, useInvalidate, useKfs, useOffers } from "@/api/hooks";
import type { Application } from "@/api/types";
import { Callout, ErrorBox, Spinner } from "@/components/ui";
import { daysFrom, inr } from "@/lib/format";
import { FinanceFrame } from "./Frame";

/** F12: offers comparison. An offer is not disbursal. */
export function Offers() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { data: app } = useApplication(id);
  const { data, error, refetch } = useOffers(id);
  useApplicationStream(id);
  useEffect(() => { if (app && app.current_step !== "offers") nav(`/finance/${id}`, { replace: true }); }, [app, id, nav]);
  if (error) return <FinanceFrame app={app}><ErrorBox error={error} retry={() => refetch()} /></FinanceFrame>;
  if (!data || !app) return <FinanceFrame app={app}><Spinner /></FinanceFrame>;
  const lowestApr = Math.min(...data.items.map((o) => o.apr));
  return (
    <FinanceFrame app={app} stage="offers">
      <div className="space-y-5">
        <div>
          <p className="chip bg-go-light text-go-dark">F12 · Offers from {app.lender.name}</p>
          <h1 className="mt-2 text-2xl sm:text-3xl">Compare your offers</h1>
          <p className="mt-1 font-semibold text-ink-soft">An offer is not a payout: nothing moves until you read the Key Facts Statement, accept, set up repayments and sign. The APR includes fees, so it's higher than the rate used for the EMI.</p>
        </div>
        <ul className="grid gap-4 md:grid-cols-2">
          {data.items.map((o, i) => (
            <li key={o.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xl">{inr(o.emi)}<span className="text-sm font-bold text-ink-mute"> / month</span></h2>
                {o.conditional && <span className="chip bg-sun-light text-sun-dark">Conditional</span>}
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                {([["Loan", inr(o.amount)], ["Tenure", `${o.tenure} months`], ["Interest rate", `${o.rate}% a year`], ["APR (with fees)", `${o.apr}%`], ["Upfront fees", inr(o.fees)], ["Total you repay", inr(o.total)]] as const).map(([k, v]) => (
                  <div key={k}><dt className="text-xs font-extrabold uppercase text-ink-mute">{k}</dt><dd className="font-black">{v}{k === "APR (with fees)" && o.apr === lowestApr && data.items.length > 1 && <span className="ml-1 text-xs font-extrabold text-go-dark">lowest APR here</span>}</dd></div>
                ))}
              </dl>
              {o.conditions.map((c) => <p key={c} className="text-sm font-bold text-sun-dark">Condition: {c}</p>)}
              <p className="flex items-center gap-1.5 text-xs font-bold text-ink-mute"><Clock className="h-3.5 w-3.5" aria-hidden /> Valid for {Math.max(0, daysFrom(o.expires_at))} more days</p>
              <Link to={`/finance/${id}/offers/${o.id}`} className={i === 0 ? "btn-go mt-auto" : "btn-ghost mt-auto"}>Read the KFS &amp; choose</Link>
            </li>
          ))}
        </ul>
        <Callout>Lowest APR isn't automatically best for you. A longer tenure lowers the EMI but raises the total you repay.</Callout>
      </div>
    </FinanceFrame>
  );
}

/** F13: Key Facts Statement acknowledgement, bound to the KFS version. */
export function KfsPage() {
  const { id = "", oid = "" } = useParams();
  const nav = useNavigate();
  const inv = useInvalidate();
  const { data: app } = useApplication(id);
  const { data: kfs, error, refetch } = useKfs(id, oid);
  const [ack, setAck] = useState(false);
  const [idem] = useState(() => crypto.randomUUID());
  const accept = useMutation({
    mutationFn: () => api<Application>(`/applications/${id}/offers/${oid}/accept`, { body: { kfs_version: kfs!.version, acknowledged: ack }, idem }),
    onSuccess: () => { inv("application", "offers", "applications"); nav(`/finance/${id}`); },
  });
  if (error) return <FinanceFrame app={app}><ErrorBox error={error} retry={() => refetch()} /></FinanceFrame>;
  if (!kfs) return <FinanceFrame app={app}><Spinner label="Preparing your Key Facts Statement" /></FinanceFrame>;
  const fmt = (v: string | number, label: string) => (typeof v === "number" && !/month|tenure/i.test(label) ? inr(v) : String(v));
  return (
    <FinanceFrame app={app} stage="kfs">
      <div className="space-y-5">
        <Link to={`/finance/${id}/offers`} className="inline-flex items-center gap-1 text-sm font-extrabold text-ink-soft"><ArrowLeft className="h-4 w-4" /> Back to offers</Link>
        <div><p className="chip bg-ink/10 text-ink-soft">F13 · {kfs.version}</p><h1 className="mt-2 text-2xl sm:text-3xl">Key Facts Statement</h1>
          <p className="mt-1 font-semibold text-ink-soft">From {kfs.lender}. Read it before you accept.</p></div>
        {kfs.sections.map((s) => (
          <section key={s.title} className="card"><h2 className="mb-2 text-lg">{s.title}</h2>
            <dl className="divide-y divide-ink/10">{s.rows.map(([k, v]) => <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[1fr_1.2fr]"><dt className="font-bold text-ink-soft">{k}</dt><dd className="font-black">{fmt(v, k)}</dd></div>)}</dl></section>
        ))}
        <Callout tone="warn">{kfs.note}</Callout>
        <div className="card space-y-4">
          <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-2xl border-2 border-ink/15 p-3.5 font-bold">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-go" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            <span>I have read the Key Facts Statement ({kfs.version}) and want to accept this offer from {kfs.lender}.</span>
          </label>
          {accept.error instanceof ApiError && <p className="err" role="alert">{accept.error.message}</p>}
          <button className="btn-go" disabled={!ack || accept.isPending} onClick={() => accept.mutate()}>{accept.isPending ? "Accepting…" : "Accept this offer"}</button>
        </div>
      </div>
    </FinanceFrame>
  );
}
