import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Lightbulb } from "lucide-react";
import { useApplication, useApplicationStream, useInvalidate } from "@/api/hooks";
import type { Requirement } from "@/api/types";
import { UploadField } from "@/components/UploadField";
import { Callout, ErrorBox, Spinner, StatusChip } from "@/components/ui";
import { KIND_LABEL } from "@/lib/upload";
import { FinanceFrame } from "./Frame";

/** F04 / F11: only the items the lender or KYC flagged, with the reason and alternatives. May loop. */
export default function Remediation() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const inv = useInvalidate();
  const { data: app, error, refetch } = useApplication(id);
  useApplicationStream(id);

  const open = app?.requirements.filter((r) => r.status === "open") ?? [];
  const resolved = app?.requirements.filter((r) => r.status === "resolved") ?? [];
  useEffect(() => { if (app && !open.length) nav(`/finance/${id}`, { replace: true }); }, [app, open.length, id, nav]);

  if (error) return <FinanceFrame stage="remediation"><ErrorBox error={error} retry={() => refetch()} /></FinanceFrame>;
  if (!app) return <FinanceFrame stage="remediation"><Spinner /></FinanceFrame>;
  const underwriting = app.state === "more_info";

  return (
    <FinanceFrame app={app} stage={underwriting ? "status" : "remediation"}>
      <div className="space-y-5">
        <div>
          <p className="chip bg-sun-light text-sun-dark">{underwriting ? "F11 · The lender needs a little more" : "F04 · A quick fix to continue"}</p>
          <h1 className="mt-2 text-2xl sm:text-3xl">{open.length === 1 ? "One thing is needed" : `${open.length} things are needed`}</h1>
          <p className="mt-1 font-semibold text-ink-soft">This is not a rejection. {underwriting ? `${app.lender.name} is waiting on these items.` : "We need this to move forward."} We only ask for what's missing and never repeat a check you've passed.</p>
        </div>
        {open.map((r) => <ReqCard key={r.id} r={r} appId={id} onDone={() => { inv("application", "timeline"); }} />)}
        {!!resolved.length && (
          <section aria-label="Already done" className="card">
            <h2 className="mb-2 text-base">Already sorted</h2>
            <ul className="space-y-1.5">{resolved.map((r) => <li key={r.id} className="flex items-center gap-2 font-bold text-go-dark"><CheckCircle2 className="h-5 w-5" aria-hidden />{r.label}</li>)}</ul>
          </section>
        )}
      </div>
    </FinanceFrame>
  );
}

function ReqCard({ r, appId, onDone }: { r: Requirement; appId: string; onDone: () => void }) {
  const [kind, setKind] = useState(r.accepts[0]);
  return (
    <section className="card space-y-4 border-sun/60" aria-labelledby={`req-${r.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 id={`req-${r.id}`} className="text-lg">{r.label}</h2><StatusChip status="open" /></div>
      <p className="font-bold text-ink-soft"><span className="text-ink">Why:</span> {r.reason}</p>
      {!!r.alternatives.length && (
        <div className="flex gap-3 rounded-2xl bg-sky-light/60 p-3 text-sm font-semibold">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-sky-dark" aria-hidden />
          <div><p className="font-extrabold">You can also</p><ul className="list-disc pl-5">{r.alternatives.map((a) => <li key={a}>{a}</li>)}</ul></div>
        </div>
      )}
      {r.accepts.length > 1 && (
        <div><label className="label" htmlFor={`k-${r.id}`}>Document to upload</label>
          <select id={`k-${r.id}`} className="input" value={kind} onChange={(e) => setKind(e.target.value)}>{r.accepts.map((k) => <option key={k} value={k}>{KIND_LABEL[k] ?? k}</option>)}</select></div>
      )}
      <UploadField id={`up-${r.id}`} kind={kind} requirementId={r.id} applicationId={appId} capture={kind === "selfie" ? "user" : undefined}
        label={r.accepts.length > 1 ? undefined : `Upload ${r.label.toLowerCase()}`} onResult={onDone}
        hint={kind === "selfie" ? "Take a clear selfie in good light" : "Demo tip: a filename containing “blurry” is rejected and “mismatch” needs attention"} />
      <Callout tone="info">We check it within seconds and tell you the outcome here. If it needs another try we'll say exactly why.</Callout>
    </section>
  );
}
