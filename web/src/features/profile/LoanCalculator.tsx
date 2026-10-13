import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useGoals, useInvalidate } from "@/api/hooks";
import type { Model, Vehicle } from "@/api/types";
import { ModelPicker } from "@/components/ModelPicker";
import { ErrorBox } from "@/components/ui";
import { inr } from "@/lib/format";

export function LoanCalculator({ vehicles }: { vehicles: Vehicle[] }) {
  const [choosing, setChoosing] = useState(false);
  const [model, setModel] = useState<Model | null>(null);
  const [price, setPrice] = useState(300000);
  const [cash, setCash] = useState(60000);
  const [rate, setRate] = useState(11.5);
  const [months, setMonths] = useState(36);
  const [saleId, setSaleId] = useState("");
  const { data: goals } = useGoals();
  const nav = useNavigate();
  const inv = useInvalidate();
  const sale = vehicles.find(v => v.id === saleId);
  const known = !sale || (!!sale.valuation && sale.equity.known);
  const payoff = sale?.loan.status === "none" ? 0 : sale?.loan.principal;
  const proceeds = sale?.valuation && payoff != null ? sale.valuation.mid - payoff - 3000 : 0;
  const principal = Math.max(0, price - cash - proceeds);
  const r = rate / 1200;
  const factor = (1 + r) ** months;
  const emi = principal ? Math.round(r ? principal * r * factor / (factor - 1) : principal / months) : 0;
  const save = useMutation({
    mutationFn: () => {
      const goal = goals?.items.find(g => g.target_model?.id === model?.id);
      return api<{ id: string }>(goal ? `/goals/${goal.id}` : "/goals", { method: goal ? "PATCH" : "POST", body: { target_model_id: model!.id, price_assumption: price, savings: cash, sell_current: saleId || null } });
    },
    onSuccess: goal => { inv("goals", "garage"); nav(`/ownership/${goal.id}?rate=${rate}&tenure=${months}`); },
  });
  return <section className="card space-y-3 !p-4" aria-labelledby="calculator-title">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 id="calculator-title" className="text-xl">EMI calculator</h2><p className="text-xs text-ink-mute">{known ? `${inr(principal)} to finance · ${months} months` : "Confirm sale vehicle details"}</p></div><div className="text-right"><p className="text-[10px] font-bold uppercase text-go-dark">Estimated EMI</p><p className="text-2xl font-black text-go-dark">{known ? inr(emi) : "Unknown"}<span className="text-xs font-bold">/mo*</span></p></div></div>
    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
      {[["Vehicle price (₹)", price, setPrice], ["Cash down payment (₹)", cash, setCash], ["Annual interest (%)", rate, setRate]].map(([label, value, on], i) => <label key={String(label)} className="!mb-0 text-xs font-bold text-ink-soft">{String(label)}<input className="input mt-1 !min-h-[40px] !py-2" type="number" min="0" max={i === 2 ? 40 : 50000000} step={i === 2 ? ".1" : "1000"} value={value as number} onChange={e => (on as (n:number) => void)(Math.max(0, Math.min(i === 2 ? 40 : 50000000, Number(e.target.value))))} /></label>)}
      <label className="text-xs font-bold text-ink-soft">Tenure<select className="input mt-1 !min-h-[40px] !py-2" value={months} onChange={e => setMonths(Number(e.target.value))}>{[12,24,36,48].map(n => <option key={n} value={n}>{n} months</option>)}</select></label>
    </div>
    {!!vehicles.length && <details className="rounded-lg border border-ink/10 px-2 py-1.5"><summary className="cursor-pointer text-xs font-bold">{sale ? `Selling: ${sale.label}` : "Include current vehicle sale (optional)"}</summary><select className="input mt-2 !min-h-[40px] !py-2" aria-label="Vehicle to sell" value={saleId} onChange={e => setSaleId(e.target.value)}><option value="">Keep my current vehicles</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.label} ({v.year})</option>)}</select>
    {sale && <p className="mt-2 text-xs text-ink-soft">{known ? `Sale ${inr(sale.valuation!.mid)} − loan ${inr(payoff ?? 0)} − ₹3,000 costs = ${inr(proceeds)} available.` : "Confirm valuation and loan balance in Garage first."}</p>}</details>}
    <button type="button" className="flex w-full items-center justify-between gap-2 rounded-lg border border-ink/15 px-3 py-2 text-left text-xs font-bold" aria-expanded={choosing} aria-controls="calculator-vehicle-picker" onClick={() => setChoosing(v => !v)}><span>{model ? model.label : "Choose a vehicle to save this plan"}</span><span aria-hidden>{choosing ? "−" : "+"}</span></button>
    {choosing && <div id="calculator-vehicle-picker"><ModelPicker id="insights-model" compact value={model?.id} onPick={m => { setModel(m); setChoosing(false); const quote = Math.round((m.price_low + m.price_high)/2); setPrice(quote); setCash(Math.round(quote*.2)); }} /></div>}
    <p className="text-[11px] leading-relaxed text-ink-mute">*Reducing-balance estimate; lender fees excluded. Include registration/insurance in your vehicle price. Offers may differ.</p>
    {model?.type === "car" && <p className="text-xs text-sun-dark">Current lender supports two-wheelers; car estimates are illustrative.</p>}
    <button className="btn-go w-full !min-h-[40px]" disabled={!model || !known || save.isPending || principal < 10000 || principal > price} onClick={() => save.mutate()}>Explore financing</button>
    {principal < 10000 && <p className="text-xs text-sun-dark">Minimum loan: ₹10,000.</p>}{principal > price && <p className="text-xs text-sun-dark">Add cash to cover your existing loan shortfall.</p>}
    {save.error && <ErrorBox error={save.error} />}
  </section>;
}
