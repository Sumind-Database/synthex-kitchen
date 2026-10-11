import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search, Eye, Pencil, Play, CheckCheck, Ban, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore, saveOrder, setOrderStatus, deleteOrder, requirements, orderCost, fmtCOP, fmtQty, fmtDate, fmtDateTime, type ProductionOrder, type OrderStatus } from "@/lib/store";
import { useColumnTable, type Col } from "@/components/col-table";
import { PageHeader, Panel, DataTable, SidePanel, FormFooter, Confirm, Field, Select, notify } from "@/components/kit";
import { OrderBadge, ORDER_LABEL } from "@/components/badges";

export const Route = createFileRoute("/app/produccion")({
  head: () => ({ meta: [{ title: "Producción — Synthex Kitchen" }, { name: "description", content: "Órdenes de producción de masas y salsas." }, { property: "og:title", content: "Producción — Synthex Kitchen" }, { property: "og:description", content: "Transforma materias primas en preparaciones." }] }),
  component: Produccion,
});

type Draft = { id?: string; recipeId: string; qty: number; date: string; status: "borrador" | "pendiente" };
const today = () => new Date().toISOString().slice(0, 10);

function Produccion() {
  const s = useStore()!;
  const [edit, setEdit] = useState<Draft | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [act, setAct] = useState<{ o: ProductionOrder; to: OrderStatus | "delete" } | null>(null);
  const recipe = (id: string) => s.recipes.find((r) => r.id === id);
  const prodOf = (o: ProductionOrder) => s.products.find((p) => p.id === recipe(o.recipeId)?.productId);
  const cols: Col<ProductionOrder>[] = [
    { label: "Código", type: "text", value: (o) => o.code },
    { label: "Fecha", type: "date", value: (o) => o.date },
    { label: "Producto", type: "select", value: (o) => prodOf(o)?.name ?? "" },
    { label: "Cantidad", type: "number", value: (o) => o.qty },
    { label: "Costo estimado", type: "number", value: (o) => orderCost(s, o) },
    { label: "Estado", type: "select", value: (o) => ORDER_LABEL[o.status] },
    { label: "", type: "none" },
  ];
  const { rows, head } = useColumnTable(s.orders, cols);
  const viewed = s.orders.find((o) => o.id === view);

  const run = (o: ProductionOrder, to: OrderStatus | "delete") => {
    const msg = { delete: "Orden eliminada", cancelada: "Orden cancelada", en_produccion: "Producción iniciada", completada: "Producción completada: inventario actualizado", pendiente: "Orden enviada a pendiente", borrador: "" }[to];
    notify(to === "delete" ? deleteOrder(o.id) : setOrderStatus(o.id, to), msg);
  };
  const ACT_TEXT: Record<string, [string, string]> = {
    completada: ["¿Completar la producción?", "Se descontarán los ingredientes y se sumará el producto resultante al inventario. Esta acción no se puede repetir."],
    en_produccion: ["¿Iniciar la producción?", "Se validará que todos los ingredientes tengan stock suficiente."],
    cancelada: ["¿Cancelar la orden?", "La orden quedará cancelada y no afectará el inventario."],
    delete: ["¿Eliminar el borrador?", "La orden se eliminará definitivamente."],
    pendiente: ["¿Enviar a pendiente?", "La orden quedará lista para iniciar."],
  };

  const Actions = ({ o }: { o: ProductionOrder }) => (
    <>
      {o.status === "borrador" && <Button size="sm" variant="outline" onClick={() => setAct({ o, to: "pendiente" })}>Confirmar</Button>}
      {(o.status === "borrador" || o.status === "pendiente") && <Button size="sm" variant="outline" onClick={() => setAct({ o, to: "en_produccion" })}><Play className="h-3.5 w-3.5" />Iniciar</Button>}
      {o.status === "en_produccion" && <Button size="sm" onClick={() => setAct({ o, to: "completada" })}><CheckCheck className="h-3.5 w-3.5" />Completar</Button>}
    </>
  );

  return (
    <>
      <PageHeader title="Producción" description="Transforma materias primas en preparaciones" actions={<Button onClick={() => setEdit({ recipeId: "", qty: 1, date: today(), status: "borrador" })}><Plus className="h-4 w-4" />Nueva orden de producción</Button>} />
      <Panel>
        <div className="flex flex-wrap gap-2 border-b p-3">
          <div className="relative min-w-56 flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Buscar por código o producto" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select className="w-44" value={st} onChange={setSt}><option value="">Todos los estados</option>{Object.entries(ORDER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        </div>
        <DataTable head={["Código", "Fecha", "Producto", "Cantidad", "Costo estimado", "Estado", ""]} empty={!rows.length}>
          {rows.map((o) => {
            const p = prodOf(o);
            return (
              <tr key={o.id}>
                <td className="whitespace-nowrap font-semibold">{o.code}</td>
                <td className="text-muted-foreground">{fmtDate(o.date)}</td>
                <td>{p?.name}</td>
                <td>{fmtQty(o.qty, p?.unit ?? "und")}</td>
                <td>{fmtCOP(orderCost(s, o))}</td>
                <td><OrderBadge s={o.status} /></td>
                <td><div className="flex justify-end gap-1">
                  <Actions o={o} />
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Ver" onClick={() => setView(o.id)}><Eye className="h-4 w-4" /></Button>
                  {(o.status === "borrador" || o.status === "pendiente") && <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar" onClick={() => setEdit({ id: o.id, recipeId: o.recipeId, qty: o.qty, date: o.date.slice(0, 10), status: o.status as "borrador" })}><Pencil className="h-4 w-4" /></Button>}
                  {(o.status === "borrador" || o.status === "pendiente") && <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Cancelar" onClick={() => setAct({ o, to: "cancelada" })}><Ban className="h-4 w-4" /></Button>}
                  {o.status === "borrador" && <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Eliminar" onClick={() => setAct({ o, to: "delete" })}><Trash2 className="h-4 w-4" /></Button>}
                </div></td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>

      {edit && <OrderForm draft={edit} onClose={() => setEdit(null)} />}

      <SidePanel open={!!viewed} onClose={() => setView(null)} title={viewed ? `Orden ${viewed.code}` : ""} description={viewed ? `${prodOf(viewed)?.name} · ${fmtDate(viewed.date)}` : ""} wide
        footer={viewed && <><Button variant="outline" onClick={() => setView(null)}>Cerrar</Button><Actions o={viewed} /></>}>
        {viewed && (() => {
          const p = prodOf(viewed)!;
          const reqs = requirements(s, viewed.recipeId, viewed.qty);
          return (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border p-3"><div className="text-[11px] text-muted-foreground">Estado</div><OrderBadge s={viewed.status} /></div>
                <div className="rounded-md border p-3"><div className="text-[11px] text-muted-foreground">Planificado</div><div className="font-semibold">{fmtQty(viewed.qty, p.unit)}</div></div>
                <div className="rounded-md border p-3"><div className="text-[11px] text-muted-foreground">Resultado producido</div><div className="font-semibold">{viewed.produced != null ? fmtQty(viewed.produced, p.unit) : "—"}</div></div>
              </div>
              {viewed.completedAt && <p className="text-xs text-muted-foreground">Completada el {fmtDateTime(viewed.completedAt)}. El inventario ya fue afectado y la orden no puede ejecutarse de nuevo.</p>}
              <div className="rounded-md border">
                <DataTable head={["Insumo", "Requerido", "Disponible", "Consumido"]}>
                  {reqs.map((r) => {
                    const c = viewed.consumed?.find((x) => x.productId === r.productId);
                    return (
                      <tr key={r.productId}>
                        <td className="font-medium">{r.product?.name}</td>
                        <td>{fmtQty(c?.qty ?? r.need, r.product!.unit)}</td>
                        <td className={!c && r.missing > 0 ? "font-semibold text-destructive" : ""}>{fmtQty(r.available, r.product!.unit)}</td>
                        <td>{c ? fmtQty(c.qty, r.product!.unit) : "—"}</td>
                      </tr>
                    );
                  })}
                </DataTable>
              </div>
            </>
          );
        })()}
      </SidePanel>

      <Confirm open={!!act} onClose={() => setAct(null)} title={act ? ACT_TEXT[act.to]![0] : ""} description={act ? `${act.o.code}: ${ACT_TEXT[act.to]![1]}` : ""}
        danger={act?.to === "delete" || act?.to === "cancelada"} onConfirm={() => act && run(act.o, act.to)} />
    </>
  );
}

function OrderForm({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const s = useStore()!;
  const [d, setD] = useState<Draft>(draft);
  const preps = s.recipes.filter((r) => s.products.find((p) => p.id === r.productId)?.category === "preparacion");
  const recipe = s.recipes.find((r) => r.id === d.recipeId);
  const out = s.products.find((p) => p.id === recipe?.productId);
  const reqs = d.recipeId && d.qty > 0 ? requirements(s, d.recipeId, d.qty) : [];
  const ok = reqs.every((r) => r.missing === 0);
  const cost = reqs.reduce((a, r) => a + r.need * (r.product?.cost ?? 0), 0);
  const save = (status: Draft["status"]) => { if (notify(saveOrder({ ...d, status, date: new Date(d.date + "T12:00:00").toISOString() }), d.id ? "Orden actualizada" : status === "borrador" ? "Borrador guardado" : "Orden creada como pendiente")) onClose(); };
  return (
    <SidePanel open onClose={onClose} title={d.id ? "Editar orden" : "Nueva orden de producción"} description="Crear la orden no modifica existencias." wide
      footer={<FormFooter onCancel={onClose} onSave={() => save("pendiente")} saveLabel="Guardar como pendiente" extra={<Button variant="outline" onClick={() => save("borrador")}>Guardar borrador</Button>} />}>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Producto preparado *"><Select value={d.recipeId} onChange={(v) => setD({ ...d, recipeId: v })}><option value="">Seleccionar…</option>{preps.map((r) => <option key={r.id} value={r.id}>{s.products.find((p) => p.id === r.productId)?.name}</option>)}</Select></Field>
        <Field label={`Cantidad a producir${out ? ` (${out.unit})` : ""} *`}><Input type="number" min={0} step="any" value={d.qty} onChange={(e) => setD({ ...d, qty: Number(e.target.value) })} /></Field>
        <Field label="Fecha"><Input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} /></Field>
      </div>
      {recipe && <p className="text-xs text-muted-foreground">Rendimiento de la receta: {fmtQty(recipe.yield, out?.unit ?? "und")} por tanda.</p>}
      {reqs.length > 0 && (
        <div className="rounded-md border">
          <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
            <span className="font-semibold">Ingredientes necesarios</span>
            <span className={ok ? "text-chart-2" : "text-destructive"}>{ok ? "Stock suficiente" : "Stock insuficiente"} · {fmtCOP(cost)}</span>
          </div>
          <ul className="divide-y text-sm">
            {reqs.map((r) => (
              <li key={r.productId} className="flex items-center justify-between px-3 py-2">
                <span className="flex items-center gap-2">{r.missing > 0 ? <AlertCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-primary" />}{r.product?.name}</span>
                <span className="text-xs">Requiere <b>{fmtQty(r.need, r.product!.unit)}</b> · disp. {fmtQty(r.available, r.product!.unit)}{r.missing > 0 && <b className="ml-1 text-destructive">· faltan {fmtQty(r.missing, r.product!.unit)}</b>}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SidePanel>
  );
}
