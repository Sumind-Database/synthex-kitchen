import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Wallet, Boxes, AlertTriangle, Factory, ShoppingCart } from "lucide-react";
import { useStore, fmtCOP, fmtQty, fmtDateTime, stockStatus, CATEGORY_LABEL, type Category } from "@/lib/store";
import { Kpi, PageHeader, Panel, DataTable, Empty } from "@/components/kit";
import { MoveBadge, StockBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Dashboard — Synthex Kitchen" }, { name: "description", content: "Indicadores de inventario, producción y ventas de Forno Pizza." }, { property: "og:title", content: "Dashboard — Synthex Kitchen" }, { property: "og:description", content: "Indicadores en tiempo real de la pizzería." }] }),
  component: Dashboard,
});

const COLORS = ["var(--chart-3)", "var(--chart-1)", "var(--chart-4)"];

function Dashboard() {
  const s = useStore()!;
  const stockable = s.products.filter((p) => p.category !== "venta");
  const invValue = stockable.reduce((a, p) => a + p.stock * p.cost, 0);
  const active = s.products.filter((p) => p.active).length;
  const low = stockable.filter((p) => p.active && stockStatus(p) !== "optimo");
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
  const recent = s.movements.slice(0, 8);
  const name = (id: string) => s.products.find((p) => p.id === id);

  return (
    <>
      <PageHeader title="Dashboard" description="Resumen operativo de Forno Pizza" actions={<><Button variant="outline" asChild><Link to="/app/produccion">Nueva producción</Link></Button><Button asChild><Link to="/app/ventas">Nueva venta</Link></Button></>} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Valor del inventario" value={fmtCOP(invValue)} hint="Materias primas y preparaciones" icon={<Wallet className="h-4 w-4" />} />
        <Kpi label="Referencias activas" value={String(active)} hint={`${s.products.length} en total`} icon={<Boxes className="h-4 w-4" />} />
        <Kpi label="Stock bajo / agotado" value={String(low.length)} hint="Requieren reposición" tone={low.length ? "amber" : undefined} icon={<AlertTriangle className="h-4 w-4" />} />
        <Kpi label="Órdenes pendientes" value={String(pending)} hint="Borrador, pendiente o en curso" icon={<Factory className="h-4 w-4" />} />
        <Kpi label="Ventas del día" value={fmtCOP(todayTotal)} hint={`${todaySales.length} ventas confirmadas`} icon={<ShoppingCart className="h-4 w-4" />} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Ventas últimos 7 días" className="lg:col-span-2">
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
        <Panel title="Inventario por categoría">
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
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Movimientos recientes" className="lg:col-span-2" action={<Link to="/app/movimientos" className="text-xs font-semibold text-chart-2 hover:underline">Ver todos</Link>}>
          <DataTable head={["Fecha", "Producto", "Tipo", "Cantidad", "Referencia"]} empty={!recent.length}>
            {recent.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap text-muted-foreground">{fmtDateTime(m.date)}</td>
                <td className="font-medium">{name(m.productId)?.name}</td>
                <td><MoveBadge t={m.type} /></td>
                <td className={m.qty < 0 ? "text-destructive" : "text-chart-2"}>{m.qty > 0 ? "+" : ""}{fmtQty(m.qty, name(m.productId)?.unit ?? "und")}</td>
                <td className="text-muted-foreground">{m.refCode}</td>
              </tr>
            ))}
          </DataTable>
        </Panel>
        <Panel title="Alertas de reposición">
          {low.length ? (
            <ul className="divide-y">
              {low.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">Stock {fmtQty(p.stock, p.unit)} · mín. {fmtQty(p.min, p.unit)}</div></div>
                  <StockBadge p={p} />
                </li>
              ))}
            </ul>
          ) : <Empty text="Todos los insumos están en nivel óptimo." />}
        </Panel>
      </div>
    </>
  );
}
