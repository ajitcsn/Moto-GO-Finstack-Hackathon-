import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, Info, Truck } from "lucide-react";
import type { Vehicle } from "@/api/types";
import { asOf, inr, inrRange, SEGMENT_COLOR } from "@/lib/format";
import { cx, Disc } from "@/components/ui";

const CONF: Record<string, string> = { high: "bg-go-light text-go-dark", medium: "bg-sun-light text-sun-dark", low: "bg-ball-light text-ball-dark" };

/** Values carry source, range and as-of date. Unknown debt means equity unknown, never zero. */
export function EquityBlock({ v, big }: { v: Vehicle; big?: boolean }) {
  const { valuation: val, loan, equity } = v;
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs font-extrabold uppercase text-ink-mute">Estimated value</dt>
          <dd className="text-lg font-black">{val ? inrRange(val.low, val.high) : "Not valued"}</dd>
        </div>
        <div>
          <dt className="text-xs font-extrabold uppercase text-ink-mute">Loan outstanding</dt>
          <dd className="text-lg font-black">{loan.status === "active" ? inr(loan.principal) : loan.status === "none" ? "None" : "Unknown"}</dd>
        </div>
      </dl>
      {equity.known ? (
        <div className={cx("rounded-2xl p-3.5", equity.negative ? "bg-ball-light/60" : "bg-go-light/60")}>
          <p className={cx("text-xs font-extrabold uppercase", equity.negative ? "text-ball-dark" : "text-go-dark")}>Estimated equity</p>
          <p className={cx("font-black", big ? "text-3xl" : "text-2xl", equity.negative ? "text-ball-dark" : "text-go-dark")}>{inrRange(equity.low, equity.high)}</p>
          {equity.negative && <p className="text-sm font-bold text-ball-dark">You may owe more than it's worth. Treat the gap as extra funding needed if you sell.</p>}
          <p className="mt-1 text-xs font-bold text-ink-soft">
            {val?.source}, {val && asOf(val.as_of)} · loan {loan.source === "statement_parsed" ? "read from your statement" : "entered by you"}
            {loan.statement_date && ` (${asOf(loan.statement_date)})`}{" "}
            <span className={cx("chip ml-1 !py-0.5", CONF[equity.confidence ?? "low"])}>{equity.confidence} confidence</span>
          </p>
        </div>
      ) : (
        <div className="flex gap-3 rounded-2xl border-2 border-dashed border-ink/20 bg-white p-3.5">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-dark" aria-hidden />
          <div className="text-sm font-bold text-ink-soft">
            <p className="font-extrabold text-ink">Equity unknown</p>
            {equity.reason === "loan_unknown" ? "We don't know your loan balance, so we won't guess. Add it to see your equity." :
              v.verified_model ? "Add year and condition details to get a value." : "We can only value models from the catalogue."}
          </div>
        </div>
      )}
    </div>
  );
}

export function VehicleCard({ v }: { v: Vehicle }) {
  const seg = v.model?.segment ?? "commute";
  return (
    <Link to={`/garage/${v.id}`} className="card block transition hover:border-go/60">
      <div className="flex items-center gap-3">
        <Disc color={SEGMENT_COLOR[seg]} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-black">{v.label}</p>
          <p className="text-sm font-bold text-ink-mute">{v.year} · {v.type}{v.city ? ` · ${v.city}` : ""}{!v.verified_model && " · unverified model"}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-ink-mute" aria-hidden />
      </div>
      {v.delivery_status === "pending" && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-sky-light px-3 py-2 text-sm font-extrabold text-sky-dark"><Truck className="h-4 w-4" aria-hidden /> Delivery pending: financed vehicle, not yet with you</p>
      )}
      {v.ownership === "current" && <div className="mt-4"><EquityBlock v={v} /></div>}
      {v.next_care && (
        <p className="mt-3 flex items-center gap-2 text-sm font-bold text-ink-soft"><AlertTriangle className="h-4 w-4 text-sun-dark" aria-hidden /> {v.next_care.kind} due {new Date(v.next_care.due).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
      )}
    </Link>
  );
}
