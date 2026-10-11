import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Wallet, Boxes, AlertTriangle, Factory, ShoppingCart, ArrowRight, Sparkles } from "lucide-react";
import { useStore, fmtCOP, fmtQty, stockStatus, CATEGORY_LABEL, type Category } from "@/lib/store";
import { Kpi, PageHeader, Panel, Empty } from "@/components/kit";
import { StockBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Dashboard — Synthex Kitchen" }, { name: "description", content: "Indicadores de inventario, producción y ventas de Forno Pizza." }, { property: "og:title", content: "Dashboard — Synthex Kitchen" }, { property: "og:description", content: "Indicadores en tiempo real de la cocina." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Dashboard,
});

const COLORS = ["var(--chart-3)", "var(--chart-1)", "var(--chart-4)"];

function Cta({ to, children }: { to: "/app/inventario" | "/app/produccion" | "/app/ventas"; children: string }) {
  return (
    <Button variant="outline" size="sm" className="h-7 w-full justify-between text-xs" asChild>
      <Link to={to}>{children}<ArrowRight className="h-3.5 w-3.5" /></Link>
    </Button>
  );
}

function Dashboard() {
  const s = useStore()!;
  const stockable = s.products.filter((p) => p.category !== "venta");
  const invValue = stockable.reduce((a, p) => a + p.stock * p.cost, 0);
  const active = s.products.filter((p) => p.active).length;
  const low = stockable.filter((p) => p.active && stockStatus(p) !== "optimo").sort((a, b) => a.stock / (a.min || 1) - b.stock / (b.min || 1));
  const out = low.filter((p) => stockStatus(p) === "agotado").length;
  const pending = s.orders.filter((o) => ["borrador", "pendiente", "en_produccion"].includes(o.status)).length;
  const confirmed = s.sales.filter((v) => v.status === "confirmada");
  const today = new Date().toDateString();
  const todaySales = confirmed.filter((v) => new Date(v.date).toDateString() === today);
  const todayTotal = todaySales.reduce((a, v) => a + v.total, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toDateString();
    return { dia: d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric" }), total: confirmed.filter((v) => new Date(v.date).toDateString() === key).reduce((a, v) => a + v.total, 0) };
  });
  const byCat = (["materia", "preparacion"] as Category[]).map((c) => ({ name: CATEGORY_LABEL[c], value: Math.round(stockable.filter((p) => p.category === c).reduce((a, p) => a + p.stock * p.cost, 0)) }));

  return (
    <>
      <PageHeader title="Dashboard" description="Resumen operativo de Forno Pizza" actions={<><Button variant="outline" asChild><Link to="/app/produccion">Nueva producción</Link></Button><Button asChild><Link to="/app/ventas">Nueva venta</Link></Button></>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <Kpi label="Valor del inventario" value={fmtCOP(invValue)} hint="Materias primas y preparaciones" icon={<Wallet className="h-4 w-4" />} cta={<Cta to="/app/inventario">Ver inventario</Cta>} />
          <Kpi label="Referencias activas" value={String(active)} hint={`${s.products.length} en total`} icon={<Boxes className="h-4 w-4" />} cta={<Cta to="/app/inventario">Ver referencias</Cta>} />
          <Kpi label="Órdenes pendientes" value={String(pending)} hint="Borrador, pendiente o en curso" icon={<Factory className="h-4 w-4" />} cta={<Cta to="/app/produccion">Ver órdenes</Cta>} />
          <Kpi label="Ventas del día" value={fmtCOP(todayTotal)} hint={`${todaySales.length} ventas confirmadas`} icon={<ShoppingCart className="h-4 w-4" />} cta={<Cta to="/app/ventas">Ver ventas</Cta>} />
        </div>
        <div className="flex flex-col rounded-lg border bg-card">
          <div className="flex items-start justify-between border-b p-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Stock bajo / agotado · Alertas de reposición</div>
              <div className="mt-1 text-2xl font-bold tracking-tight">{low.length}</div>
              <div className="text-xs text-muted-foreground">{out} agotados · {low.length - out} en stock bajo</div>
            </div>
            <span className={low.length ? "rounded-md bg-warning/10 p-1.5 text-warning" : "rounded-md bg-accent p-1.5 text-chart-2"}><AlertTriangle className="h-4 w-4" /></span>
          </div>
          {low.length ? (
            <ul className="max-h-64 flex-1 divide-y overflow-y-auto">
              {low.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <div className="min-w-0"><div className="truncate font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{CATEGORY_LABEL[p.category]} · {fmtQty(p.stock, p.unit)} / mín. {fmtQty(p.min, p.unit)}</div></div>
                  <StockBadge p={p} />
                </li>
              ))}
            </ul>
          ) : <Empty text="Todos los insumos están en nivel óptimo." />}
          <div className="border-t p-3"><Cta to="/app/inventario">Ver en inventario</Cta></div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Ventas últimos 7 días" className="lg:col-span-2" action={<Link to="/app/ventas" className="text-xs font-semibold text-chart-2 hover:underline">Ver ventas</Link>}>
          <div className="h-64 p-4">
            <ResponsiveContainer>
              <BarChart data={days}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="dia" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v: number) => fmtCOP(v)} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="total" name="Ventas" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Inventario por categoría" action={<Link to="/app/inventario" className="text-xs font-semibold text-chart-2 hover:underline">Ver detalle</Link>}>
          <div className="h-44 p-2">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                  {byCat.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtCOP(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 px-4 pb-4 text-sm">
            {byCat.map((c, i) => (
              <div key={c.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i] }} />{c.name}</span>
                <span className="font-semibold">{fmtCOP(c.value)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="rounded-md bg-accent p-1.5 text-chart-2"><Sparkles className="h-4 w-4" /></span>
          <div>
            <div className="text-sm font-semibold">Asistente de producción IA</div>
            <div className="text-xs text-muted-foreground">Sugiere cuánta masa y salsa preparar hoy según stock, recetas y ventas recientes.</div>
          </div>
        </div>
        <Button size="sm" asChild><Link to="/app/produccion" search={{ ia: true }}><Sparkles className="h-3.5 w-3.5" />Sugerir producción</Link></Button>
      </div>
    </>
  );
}
