import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { GitCompare, Heart, Trash2 } from "lucide-react";
import { api } from "@/api/client";
import { useGoals, useInvalidate } from "@/api/hooks";
import { ModelPicker } from "@/components/ModelPicker";
import { Disc, EmptyState, ErrorBox, PageHeader, Spinner, useToast } from "@/components/ui";
import { dateFmt, inr, SEGMENT_COLOR } from "@/lib/format";

export default function Roadmap() {
  const { data, isLoading, error, refetch } = useGoals();
  const nav = useNavigate();
  const inv = useInvalidate();
  const toast = useToast();
  const create = useMutation({
    mutationFn: (target_model_id: string) => api<{ id: string }>("/goals", { body: { target_model_id } }),
    onSuccess: (g) => { inv("goals", "garage"); nav(`/roadmap/goal/${g.id}`); },
  });
  const del = useMutation({ mutationFn: (id: string) => api(`/goals/${id}`, { method: "DELETE" }), onSuccess: () => { inv("goals", "garage"); toast("Goal removed"); } });

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} retry={() => refetch()} />;
  return (
    <>
      <PageHeader title="Roadmap" sub="Plan the next vehicle on assumptions you can see. Finance is one option among several, never the default."
        action={<div className="flex gap-2"><Link to="/dream" className="btn-ghost"><Heart className="h-4 w-4" aria-hidden /> Dream Garage</Link><Link to="/roadmap/compare" className="btn-ghost"><GitCompare className="h-4 w-4" aria-hidden /> Compare</Link></div>} />
      <div className="grid gap-6 md:grid-cols-2">
        <section aria-label="Your goals" className="space-y-3">
          <h2 className="text-lg">Your goals</h2>
          {!data.items.length ? (
            <EmptyState title="No Road-to yet" body="Pick a vehicle you'd love on the right and see what saving, buying used, selling or financing really means."><span /></EmptyState>
          ) : data.items.map((g) => (
            <div key={g.id} className="card flex items-center gap-4">
              <Disc color={SEGMENT_COLOR[g.target_model?.segment ?? "commute"]} size={44} />
              <Link to={`/roadmap/goal/${g.id}`} className="min-w-0 flex-1">
                <p className="truncate text-lg font-black">Road to {g.target_model?.label}</p>
                <p className="text-sm font-bold text-ink-soft">Assuming {inr(g.price_assumption)}{g.target_date && ` · by ${dateFmt(g.target_date)}`}</p>
              </Link>
              <button className="btn-quiet !p-2" aria-label={`Delete goal ${g.target_model?.label}`} onClick={() => del.mutate(g.id)}><Trash2 className="h-5 w-5" /></button>
            </div>
          ))}
        </section>
        <section className="card" aria-label="Start a goal">
          <h2 className="mb-1 text-lg">Start a Road-to</h2>
          <p className="mb-3 text-sm font-semibold text-ink-soft">Where do you want to go next?</p>
          <ModelPicker id="goal-model" onPick={(m) => !create.isPending && create.mutate(m.id)} compact />
        </section>
      </div>
    </>
  );
}
