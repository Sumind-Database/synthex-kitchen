import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Package, BookOpen, Factory, ShoppingCart, ArrowLeftRight, Settings, Pizza, LogOut, RotateCcw, Menu } from "lucide-react";
import { useState } from "react";
import { useStore, resetData } from "@/lib/store";
import { Confirm } from "@/components/kit";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({ component: AppLayout });

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/inventario", label: "Inventario", icon: Package },
  { to: "/app/recetas", label: "Recetas", icon: BookOpen },
  { to: "/app/produccion", label: "Producción", icon: Factory },
  { to: "/app/ventas", label: "Ventas", icon: ShoppingCart },
  { to: "/app/movimientos", label: "Movimientos", icon: ArrowLeftRight },
] as const;

function AppLayout() {
  const s = useStore();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [reset, setReset] = useState(false);
  const [settings, setSettings] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><Pizza className="h-5 w-5" /></div>
          <div>
            <div className="text-base font-bold leading-tight text-sidebar-accent-foreground">PizzaFlow</div>
            <div className="text-[11px] opacity-70">Forno Pizza</div>
          </div>
        </div>
        <div className="px-5 pb-2 text-[10px] font-semibold uppercase tracking-widest opacity-50">Módulos</div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)} activeOptions={{ exact: "exact" in n }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium opacity-80 transition hover:bg-sidebar-accent/60 hover:opacity-100"
              activeProps={{ className: "!bg-sidebar-accent !opacity-100 text-sidebar-accent-foreground" }}>
              <n.icon className="h-4 w-4" />{n.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-0.5 border-t border-sidebar-border px-3 py-3">
          <button onClick={() => setSettings((v) => !v)} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm opacity-80 hover:bg-sidebar-accent/60 hover:opacity-100"><Settings className="h-4 w-4" />Configuración</button>
          {settings && (
            <button onClick={() => setReset(true)} className="flex w-full items-center gap-3 rounded-md px-3 py-2 pl-10 text-xs opacity-80 hover:bg-sidebar-accent/60"><RotateCcw className="h-3.5 w-3.5" />Restablecer datos demo</button>
          )}
          <div className="mt-2 flex items-center gap-3 rounded-md bg-sidebar-accent/40 px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">LG</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-sidebar-accent-foreground">Laura Gómez</div>
              <div className="truncate text-[11px] opacity-70">Administradora</div>
            </div>
            <button aria-label="Salir" onClick={() => nav({ to: "/" })} className="opacity-70 hover:opacity-100"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-foreground/30 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-12 items-center border-b bg-card px-4 lg:hidden">
          <button aria-label="Menú" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
          <span className="ml-3 font-bold">PizzaFlow</span>
        </header>
        <main className="mx-auto max-w-7xl p-5 md:p-8">
          {s ? <Outlet /> : <div className="py-20 text-center text-sm text-muted-foreground">Cargando…</div>}
        </main>
      </div>
      <Confirm open={reset} onClose={() => setReset(false)} title="¿Restablecer datos demo?" description="Se eliminarán todos los cambios y se cargarán de nuevo los datos iniciales de Forno Pizza." label="Restablecer" danger
        onConfirm={() => { resetData(); toast.success("Datos restablecidos"); }} />
    </div>
  );
}
