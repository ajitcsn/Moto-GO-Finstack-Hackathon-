import { Check, Circle, Flag, KeyRound, Trophy } from "lucide-react";
import { cx } from "@/components/ui";

export const journeyStages = (badges: string[]) => [
  { label: "Test drive", done: badges.includes("test_driven"), icon: Flag },
  { label: "Rent", done: badges.some(b => ["rented", "short_rental", "long_rental"].includes(b)), icon: KeyRound },
  { label: "Own", done: badges.includes("owned") || badges.includes("owned_past"), icon: Trophy },
];

export function JourneyProgress({ badges }: { badges: string[] }) {
  const stages = journeyStages(badges);
  const completed = stages.filter(s => s.done).length;
  return <div className="space-y-2" aria-label={`${completed} of 3 vehicle milestones completed`}>
    <ol className="flex items-center gap-1">{stages.map(({ label, done, icon: Icon }, i) => <li key={label} className="flex min-w-0 flex-1 items-center gap-1">
      {i > 0 && <span className={cx("h-px w-3 shrink-0", done ? "bg-go" : "bg-ink/20")} aria-hidden />}
      <span className={cx("flex items-center gap-1 text-xs font-bold", done ? "text-go-dark" : "text-ink-mute")}><Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />{label}{done ? <Check className="h-3 w-3" aria-label="Completed" /> : <Circle className="h-2 w-2" aria-label="Not completed" />}</span>
    </li>)}</ol>
    <p className={cx("text-xs font-bold", completed ? "text-go-dark" : "text-ink-mute")}>{completed}/3 milestones{completed === 3 ? " · Journey complete" : " · Choose any path"}</p>
  </div>;
}
