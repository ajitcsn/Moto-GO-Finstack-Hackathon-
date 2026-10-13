import { useEffect } from "react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { BarChart3, Compass, Gauge, Warehouse } from "lucide-react";
import { useMe } from "@/api/hooks";
import { cx, DemoBadge } from "./ui";

const NAV = [
  { to: "/garage", label: "Garage", icon: Warehouse },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/insights", label: "Insights", icon: BarChart3 },
] as const;

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2 text-xl font-black tracking-tight text-ink">
      <Gauge className="h-7 w-7 text-go" aria-hidden /> Moto Go
    </Link>
  );
}

export function AppShell() {
  const { data: me } = useMe();
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")) return;
      const index = Number(event.key) - 1;
      if (index < 0 || index >= NAV.length) return;
      event.preventDefault();
      navigate(NAV[index].to);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b-2 border-ink/10 bg-white/95 px-4 py-3 backdrop-blur md:px-8">
        <Logo />
        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="hidden sm:inline-flex"><DemoBadge /></span>
          {me ? (
            <Link to="/insights" className="min-w-0 max-w-[46vw] rounded-xl bg-go-light px-3 py-1.5 text-right text-xs font-extrabold text-go-dark sm:max-w-xs" title={`Level ${me.level} · ${me.title} · ${me.xp.toLocaleString("en-IN")} points`} aria-label={`Level ${me.level}, ${me.title}, ${me.xp} points. Open Insights`}>
              <span className="flex min-w-0 items-center justify-end gap-1.5"><span className="shrink-0">Lv {me.level}</span><span className="truncate">{me.title}</span></span>
              <span className="block font-mono text-sm text-sun-dark">{me.xp.toLocaleString("en-IN")} pts</span>
            </Link>
          ) : <Link to="/signup" className="btn-go !min-h-[42px] !px-4 text-sm">Sign up</Link>}
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl overflow-x-hidden px-4 pb-28 pt-6 md:px-8 md:pt-10"><Outlet /></main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t-2 border-ink/10 bg-white px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-8px_30px_rgba(30,45,60,0.08)]" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon }, index) => (
          <NavLink key={to} to={to} title={`Press ${index + 1} to open ${label}`} aria-label={`${label}. Hotkey ${index + 1}`} className={({ isActive }) => cx("flex min-h-[58px] flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-extrabold transition sm:text-xs",
            isActive ? "bg-go-light text-go-dark" : "text-ink-mute hover:bg-ink/5")}>
            <span className="relative"><Icon className="h-5 w-5" aria-hidden /><kbd className="absolute -right-3 -top-2 rounded border border-current/35 bg-white px-1 font-mono text-[9px] leading-3 text-ink-mute">{index + 1}</kbd></span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
