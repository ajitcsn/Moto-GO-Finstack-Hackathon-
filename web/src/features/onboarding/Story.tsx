import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useMe } from "@/api/hooks";
import { Logo } from "@/components/AppShell";
import { cx, useToast } from "@/components/ui";

const OWN = [["own", "I own a vehicle"], ["owned_before", "I've owned one before"], ["exploring", "Just exploring"]] as const;
const INTERESTS = [["commute", "Daily commute"], ["touring", "Touring"], ["adventure", "Adventure"], ["performance", "Performance"], ["ev", "Electric"], ["classics", "Classics"]] as const;

export default function Story() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: me } = useMe();
  const [own, setOwn] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (arr: string[], set: (a: string[]) => void, v: string, max = 9) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : arr.length < max ? [...arr, v] : arr);

  const save = async (next: string) => {
    setBusy(true);
    try {
      const u = await api("/me", { method: "PATCH", body: { ownership_tags: own, city, interests, story_done: true } });
      qc.setQueryData(["me"], u);
      nav(next, { replace: true });
    } catch { toast("We couldn't save that. You can add it later from your profile.", "err"); nav(next, { replace: true }); }
    finally { setBusy(false); }
  };

  const skip = async () => { await api("/me", { method: "PATCH", body: { story_done: true } }).catch(() => undefined); qc.invalidateQueries({ queryKey: ["me"] }); nav("/garage", { replace: true }); };

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 md:hidden"><Logo /></div>
      <h1 className="text-3xl">Hi {me?.display_name}, what's your story?</h1>
      <p className="mt-1 font-semibold text-ink-soft">All optional. Owned, experienced and dream vehicles are different things here. We never ask for your location.</p>

      <fieldset className="mt-6">
        <legend className="label">Where are you on the road?</legend>
        <div className="flex flex-wrap gap-2.5">
          {OWN.map(([v, l]) => <Pill key={v} on={own.includes(v)} onClick={() => toggle(own, setOwn, v)}>{l}</Pill>)}
        </div>
      </fieldset>

      <div className="mt-6">
        <label htmlFor="city" className="label">City <span className="font-semibold text-ink-mute">(typed, for local experiences)</span></label>
        <input id="city" className="input" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} autoComplete="address-level2" />
      </div>

      <fieldset className="mt-6">
        <legend className="label">What do you like? <span className="font-semibold text-ink-mute">Pick up to 3 ({interests.length}/3)</span></legend>
        <div className="flex flex-wrap gap-2.5">
          {INTERESTS.map(([v, l]) => <Pill key={v} on={interests.includes(v)} onClick={() => toggle(interests, setInterests, v, 3)} disabled={!interests.includes(v) && interests.length >= 3}>{l}</Pill>)}
        </div>
      </fieldset>

      <div className="mt-8 flex flex-wrap gap-3">
        <button className="btn-go" disabled={busy} onClick={() => save("/garage/add")}>Add my current vehicle</button>
        <button className="btn-ghost" disabled={busy} onClick={() => save("/garage")}>Save and go to Garage</button>
        <button className="btn-quiet" onClick={skip}>Skip for now</button>
      </div>
    </div>
  );
}

function Pill({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} disabled={disabled} onClick={onClick}
      className={cx("min-h-[44px] rounded-full border-2 px-4 font-extrabold transition disabled:opacity-40", on ? "border-go bg-go text-white shadow-chunk-go" : "border-ink/15 bg-white hover:border-go/60")}>
      {children}
    </button>
  );
}
