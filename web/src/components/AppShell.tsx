import { NavLink, Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import { Camera, Compass, Flag, LogOut, Route as RouteIcon, UserRound, Warehouse } from "lucide-react";
import { useLogout, useMe } from "@/api/hooks";
import { cx, DemoBadge, Disc, ProgressBar } from "./ui";

const NAV = [
  { to: "/garage", label: "Garage", icon: Warehouse },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/capture", label: "Capture", icon: Camera, center: true },
  { to: "/experiences", label: "Experiences", icon: Flag },
  { to: "/roadmap", label: "Roadmap", icon: RouteIcon },
] as const;

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 text-xl font-black tracking-tight text-ink">
      <Disc color="#F0505A" size={30} /> Moto Go
    </Link>
  );
}

function LevelChip() {
  const { data: me } = useMe();
  if (!me) return null;
  return (
    <Link to="/profile" className="block rounded-2xl border-2 border-ink/10 bg-white p-2.5 shadow-chunk" aria-label={`Rider level ${me.level}, ${me.xp} experience points. Open profile`}>
      <div className="mb-1.5 flex items-center justify-between text-xs font-extrabold">
        <span>Lv {me.level} · {me.title}</span><span className="text-ink-mute">{me.xp} XP</span>
      </div>
      <ProgressBar value={me.xp % 50} max={50} label="Progress to next level" tone="sun" />
    </Link>
  );
}

export function AppShell() {
  const { data: me } = useMe();
  const logout = useLogout();
  const nav = useNavigate();
  const loc = useLocation();
  const signOut = async () => { await logout.mutateAsync(); nav("/"); };

  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-2 border-r-2 border-ink/10 bg-white p-5 md:flex" aria-label="Main">
        <div className="mb-4 flex items-center justify-between"><Logo /><DemoBadge /></div>
        <nav className="flex flex-1 flex-col gap-1.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cx("flex min-h-[48px] items-center gap-3 rounded-2xl px-4 font-extrabold transition",
              isActive ? "bg-go text-white shadow-chunk-go" : "text-ink-soft hover:bg-ink/5")}>
              <Icon className="h-5 w-5" aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>
        {me ? (
          <div className="space-y-2">
            <LevelChip />
            <div className="flex items-center gap-2 rounded-2xl border-2 border-ink/10 p-2">
              <Link to="/profile" className="flex min-h-[44px] flex-1 items-center gap-2 rounded-xl px-2 font-extrabold hover:bg-ink/5">
                <UserRound className="h-5 w-5" aria-hidden /><span className="truncate">{me.display_name}</span>
              </Link>
              <button className="btn-quiet !p-2" onClick={signOut} aria-label="Sign out"><LogOut className="h-5 w-5" /></button>
            </div>
          </div>
        ) : (
          <Link to="/signup" state={{ next: loc.pathname }} className="btn-go">Save my progress</Link>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b-2 border-ink/10 bg-white px-4 py-3 md:hidden">
          <Logo />
          <div className="flex items-center gap-2">
            <DemoBadge />
            {me ? <Link to="/profile" className="btn-ghost !min-h-[44px] !px-3 text-sm">Lv {me.level}</Link>
              : <Link to="/signup" className="btn-go !px-4 text-sm">Sign up</Link>}
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-32 pt-6 md:px-8 md:pb-12 md:pt-10"><Outlet /></main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-end border-t-2 border-ink/10 bg-white px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1 md:hidden" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon, ...rest }) => {
          const center = "center" in rest;
          return (
            <NavLink key={to} to={to} className={({ isActive }) => cx("flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold",
              isActive ? "text-go-dark" : "text-ink-mute", center && "-mt-6")}>
              {center ? (
                <span className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-ball text-white shadow-chunk-ball"><Icon className="h-7 w-7" aria-hidden /></span>
              ) : <Icon className="h-6 w-6" aria-hidden />}
              {label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
