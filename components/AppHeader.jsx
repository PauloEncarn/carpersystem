"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardCheck,
  Factory,
  LogOut,
  Settings2,
  UserRound,
} from "lucide-react";
import { CicopalLogo } from "@/components/CicopalLogo";

const destinations = [
  { href: "/", label: "Operação", Icon: ClipboardCheck },
  { href: "/supervisao", label: "Supervisão", Icon: Factory },
  { href: "/relatorios", label: "Relatórios", Icon: BarChart3 },
  { href: "/configurador", label: "Configuração", Icon: Settings2, permission: "configurator" },
];

export function AppHeader({
  title,
  subtitle,
  user,
  canAccessConfigurator = false,
  onLogout,
  maxWidth = "max-w-[1500px]",
}) {
  const pathname = usePathname();
  const visibleDestinations = destinations.filter(
    (item) => item.permission !== "configurator" || canAccessConfigurator,
  );

  return (
    <header className="app-topbar sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl">
      <div className={`mx-auto ${maxWidth} px-4`}>
        <div className="flex min-h-[72px] items-center justify-between gap-4 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" aria-label="Ir para a operação" className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
              <CicopalLogo className="h-11 w-auto" priority />
            </Link>
            <div className="min-w-0 border-l border-slate-200 pl-3">
              <p className="truncate text-sm font-black tracking-tight text-cicopal-blue sm:text-base">{title}</p>
              {subtitle ? <p className="hidden truncate text-xs font-semibold text-slate-500 sm:block">{subtitle}</p> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-2 pr-3 lg:flex">
              <span className="grid size-8 place-items-center rounded-full bg-blue-100 text-cicopal-blue"><UserRound size={16} /></span>
              <span className="max-w-36 truncate text-sm font-bold text-slate-700">{user?.nome}</span>
            </div>
            <button type="button" onClick={onLogout} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600" aria-label="Sair do sistema">
              <LogOut size={17} /> <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
        <nav aria-label="Navegação principal" className="-mx-4 flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 [scrollbar-width:none]">
          {visibleDestinations.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ${active ? "bg-cicopal-blue text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-cicopal-blue"}`}
              >
                <Icon size={17} /> {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
