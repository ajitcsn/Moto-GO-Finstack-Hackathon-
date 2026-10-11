import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "@/api/client";
import { useGarage, useGoals, useIntakeSpec, useMe } from "@/api/hooks";
import type { Application } from "@/api/types";
import { DynamicForm } from "@/components/DynamicForm";
import { Callout, ErrorBox, Spinner } from "@/components/ui";
import { FinanceFrame, WhoWhy } from "./Frame";
import { useEffect } from "react";

export default function Intake() {
  const [sp] = useSearchParams();
  const goalId = sp.get("goal");
  const nav = useNavigate();
  const { data: me, isLoading: l0 } = useMe();
  const { data: spec, isLoading, error, refetch } = useIntakeSpec();
  const { data: goals } = useGoals();
  useGarage();
  const goal = goals?.items.find((g) => g.id === goalId);
  const [serverError, setServerError] = useState<unknown>();
  const [idem] = useState(() => crypto.randomUUID());

  useEffect(() => { if (!l0 && !me) nav("/signup", { replace: true, state: { next: `/finance/start${goalId ? `?goal=${goalId}` : ""}`, reason: "Sign in to start a financing application." } }); }, [l0, me, nav, goalId]);

  if (isLoading || l0) return <FinanceFrame stage="intake" narrow><Spinner /></FinanceFrame>;
  if (error || !spec) return <FinanceFrame stage="intake" narrow><ErrorBox error={error} retry={() => refetch()} /></FinanceFrame>;

  const quote = goal?.price_assumption ?? undefined;
  const contribution = goal && quote ? Math.min(goal.savings, Math.round(quote * 0.9)) : undefined;
  const defaults = {
    model_id: goal?.target_model?.type !== "car" ? goal?.target_model?.id : undefined, new_or_used: "new", city: me?.profile?.city ?? "",
    quote, contribution, amount: quote != null && contribution != null ? quote - contribution : undefined, tenure: "24",
  };

  const submit = async (values: Record<string, unknown>) => {
    setServerError(undefined);
    try {
      const app = await api<Application>("/applications", { body: { goal_id: goal?.id ?? null, values }, idem });
      nav(`/finance/${app.id}`, { replace: true });
    } catch (e) {
      if (e instanceof ApiError && ["unsupported_applicant", "unsupported_vehicle"].includes(e.code))
        nav(`/finance/blocked?reason=${e.code}&msg=${encodeURIComponent(e.message)}`);
      else setServerError(e);
    }
  };

  return (
    <FinanceFrame stage="intake" narrow>
      <div className="mx-auto max-w-xl space-y-5">
        <div>
          <p className="chip bg-ink/10 text-ink-soft">{spec.screen} · Start</p>
          <h1 className="mt-2 text-2xl sm:text-3xl">{spec.title}</h1>
          <p className="mt-1 font-semibold text-ink-soft">{spec.intro}</p>
        </div>
        <WhoWhy lender={spec.lender.name} purpose={spec.purpose} />
        <Callout tone="ok" title="No credit check happens here">Your garage, collection and plans stay exactly as they are. You can stop at any point and pick up later, on any device.</Callout>
        <div className="card"><DynamicForm spec={spec} defaults={defaults} onSubmit={submit} serverError={serverError} submitLabel="Start my application" /></div>
      </div>
    </FinanceFrame>
  );
}
