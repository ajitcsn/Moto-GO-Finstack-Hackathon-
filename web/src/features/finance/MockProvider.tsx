import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Landmark, PenLine } from "lucide-react";
import { api, ApiError } from "@/api/client";
import { Callout, DemoBadge } from "@/components/ui";
import { Logo } from "@/components/AppShell";

/** Stands in for the AA consent screen and the e-sign provider. Reached by redirect, returns to /finance/{id}/return. */
export default function MockProvider() {
  const { provider = "" } = useParams();
  const [sp] = useSearchParams();
  const app = sp.get("app") ?? "";
  const ref = sp.get("handle") ?? sp.get("ref") ?? undefined;
  const nav = useNavigate();
  const [otp, setOtp] = useState("");
  const isAa = provider === "aa";
  const step = isAa ? "evidence" : "esign";

  const done = useMutation({
    mutationFn: () => api(`/mock/provider/${provider}/complete`, { body: { application_id: app, ref } }),
    onSuccess: () => nav(`/finance/${app}/return?step=${step}`, { replace: true }),
  });

  return (
    <div className="map-bg min-h-dvh px-4 py-6">
      <div className="mx-auto mb-5 flex max-w-md items-center justify-between"><Logo /><DemoBadge /></div>
      <div className="card mx-auto max-w-md space-y-5 !p-7">
        <p className="chip bg-sun-light text-sun-dark">Simulated {isAa ? "Account Aggregator" : "e-sign provider"} · not a real bank or signature</p>
        {isAa ? (
          <>
            <Landmark className="h-9 w-9 text-sky-dark" aria-hidden />
            <h1 className="text-2xl">Share bank data</h1>
            <dl className="space-y-2 text-sm font-bold">
              <div><dt className="text-ink-mute">Sharing with</dt><dd>Demo Finance Co. (sample NBFC)</dd></div>
              <div><dt className="text-ink-mute">Purpose</dt><dd>Income assessment for one loan application</dd></div>
              <div><dt className="text-ink-mute">Data</dt><dd>6 months of sample transactions and balances</dd></div>
              <div><dt className="text-ink-mute">Valid for</dt><dd>One-time fetch</dd></div>
            </dl>
          </>
        ) : (
          <>
            <PenLine className="h-9 w-9 text-sky-dark" aria-hidden />
            <h1 className="text-2xl">Sign your agreement</h1>
            <p className="font-semibold text-ink-soft">Sample Aadhaar-OTP e-sign. No real Aadhaar number is used.</p>
            <div><label className="label" htmlFor="otp">OTP</label><input id="otp" className="input tracking-[0.4em]" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
              <p className="help">Demo: any 6 digits work.</p></div>
          </>
        )}
        {done.error instanceof ApiError && <Callout tone="warn">{done.error.message}</Callout>}
        <div className="flex flex-col gap-3">
          <button className="btn-go" disabled={done.isPending || (!isAa && otp.length !== 6)} onClick={() => done.mutate()}>{isAa ? "Approve and share" : "Sign"}</button>
          <button className="btn-ghost" onClick={() => nav(`/finance/${app}`)}>{isAa ? "Decline" : "Cancel"}</button>
        </div>
      </div>
    </div>
  );
}
