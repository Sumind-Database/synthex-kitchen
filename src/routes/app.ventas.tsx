import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search, Eye, Trash2, Undo2, Minus, X, AlertCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore, saveSale, voidSale, deleteSale, saleNeeds, fmtCOP, fmtQty, fmtDateTime, type Sale, type SaleItem, type PayMethod } from "@/lib/store";
import { useColumnTable, type Col } from "@/components/col-table";
import { PageHeader, Panel, DataTable, SidePanel, Confirm, Field, Select, notify } from "@/components/kit";
import { SaleBadge } from "@/components/badges";

export const Route = createFileRoute("/app/ventas")({
  head: () => ({ meta: [{ title: "Ventas — Synthex Kitchen" }, { name: "description", content: "Registro de ventas de pizzas con descuento automático de insumos." }, { property: "og:title", content: "Ventas — Synthex Kitchen" }, { property: "og:description", content: "Ventas de Forno Pizza." }] }),
  component: Ventas,
});

type Draft = { id?: string; items: SaleItem[]; method: PayMethod; date: string };
const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

const SALE_TXT: Record<string, string> = { borrador: "Borrador", confirmada: "Confirmada", anulada: "Anulada" };

function Ventas() {
  const s = useStore()!;
  const [edit, setEdit] = useState<Draft | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [act, setAct] = useState<{ v: Sale; kind: "void" | "delete" } | null>(null);
  const cols: Col<Sale>[] = [
    { label: "Número", type: "text", value: (v) => v.number },
    { label: "Fecha", type: "date", value: (v) => v.date },
    { label: "Productos", type: "text", value: (v) => v.items.map((i) => `${i.qty}× ${i.name}`).join(", ") },
    { label: "Método", type: "select", value: (v) => v.method },
    { label: "Total", type: "number", value: (v) => v.total },
    { label: "Estado", type: "select", value: (v) => SALE_TXT[v.status] ?? v.status },
    { label: "", type: "none" },
  ];
  const { rows, head } = useColumnTable(s.sales, cols, { i: 1, dir: "desc" });
  const viewed = s.sales.find((v) => v.id === view);

  return (
    <>
      <PageHeader title="Ventas" description="Pizzas vendidas y consumo automático de componentes" actions={<Button onClick={() => setEdit({ items: [], method: "Efectivo", date: nowLocal() })}><Plus className="h-4 w-4" />Nueva venta</Button>} />
      <Panel>
        <DataTable head={head} empty={!rows.length}>
          {rows.map((v) => (
            <tr key={v.id}>
              <td className="whitespace-nowrap font-semibold">{v.number}</td>
              <td className="whitespace-nowrap text-muted-foreground">{fmtDateTime(v.date)}</td>
              <td className="max-w-64 truncate">{v.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</td>
              <td>{v.method}</td>
              <td className="font-semibold">{fmtCOP(v.total)}</td>
              <td><SaleBadge s={v.status} /></td>
              <td><div className="flex justify-end gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Ver" onClick={() => setView(v.id)}><Eye className="h-4 w-4" /></Button>
                {v.status === "borrador" && <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar" onClick={() => setEdit({ id: v.id, items: v.items.map((i) => ({ ...i })), method: v.method, date: v.date.slice(0, 16) })}><Pencil className="h-4 w-4" /></Button>}
                {v.status === "borrador" && <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Eliminar" onClick={() => setAct({ v, kind: "delete" })}><Trash2 className="h-4 w-4" /></Button>}
                {v.status === "confirmada" && <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Anular" onClick={() => setAct({ v, kind: "void" })}><Undo2 className="h-4 w-4" /></Button>}
              </div></td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      {edit && <SaleForm draft={edit} onClose={() => setEdit(null)} />}

      <SidePanel open={!!viewed} onClose={() => setView(null)} title={viewed ? `Venta ${viewed.number}` : ""} description={viewed ? `${fmtDateTime(viewed.date)} · ${viewed.method}` : ""}
        footer={viewed && <><Button variant="outline" onClick={() => setView(null)}>Cerrar</Button>{viewed.status === "confirmada" && <Button variant="destructive" onClick={() => setAct({ v: viewed, kind: "void" })}>Anular venta</Button>}</>}>
        {viewed && (
          <>
            <SaleBadge s={viewed.status} />
            <div className="rounded-md border">
              <DataTable head={["Producto", "Cant.", "Precio", "Subtotal"]}>
                {viewed.items.map((i) => <tr key={i.productId}><td>{i.name}</td><td>{i.qty}</td><td>{fmtCOP(i.price)}</td><td className="font-semibold">{fmtCOP(i.qty * i.price)}</td></tr>)}
              </DataTable>
              <div className="flex justify-between border-t px-4 py-3 font-bold"><span>Total</span><span>{fmtCOP(viewed.total)}</span></div>
            </div>
            <h4 className="text-sm font-semibold">Movimientos generados</h4>
            <ul className="divide-y rounded-md border text-sm">
              {s.movements.filter((m) => m.refId === viewed.id).map((m) => {
                const p = s.products.find((x) => x.id === m.productId)!;
                return <li key={m.id} className="flex justify-between px-3 py-2"><span>{p?.name} <span className="text-xs text-muted-foreground">· {m.reason}</span></span><span className={m.qty < 0 ? "text-destructive" : "text-chart-2"}>{m.qty > 0 ? "+" : ""}{fmtQty(m.qty, p?.unit ?? "und")}</span></li>;
              })}
              {!s.movements.some((m) => m.refId === viewed.id) && <li className="px-3 py-3 text-xs text-muted-foreground">Sin movimientos (venta no confirmada).</li>}
            </ul>
          </>
        )}
      </SidePanel>

      <Confirm open={!!act} onClose={() => setAct(null)} danger
        title={act?.kind === "void" ? `¿Anular la venta ${act.v.number}?` : `¿Eliminar la venta ${act?.v.number}?`}
        description={act?.kind === "void" ? "Se devolverán al inventario los componentes descontados. La anulación solo se puede hacer una vez." : "La venta de prueba se eliminará definitivamente."}
        label={act?.kind === "void" ? "Anular" : "Eliminar"}
        onConfirm={() => act && (act.kind === "void" ? notify(voidSale(act.v.id), "Venta anulada y stock revertido") : notify(deleteSale(act.v.id), "Venta eliminada"))} />
    </>
  );
}

function SaleForm({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const s = useStore()!;
  const [d, setD] = useState<Draft>(draft);
  const products = s.products.filter((p) => p.category === "venta" && p.active);
  const total = d.items.reduce((a, i) => a + i.qty * i.price, 0);
  const missing = saleNeeds(s, d.items).filter((n) => n.missing > 0);
  const add = (id: string) => {
    const p = s.products.find((x) => x.id === id)!;
    setD((x) => x.items.some((i) => i.productId === id) ? { ...x, items: x.items.map((i) => (i.productId === id ? { ...i, qty: i.qty + 1 } : i)) } : { ...x, items: [...x.items, { productId: id, name: p.name, qty: 1, price: p.price ?? 0 }] });
  };
  const setQty = (id: string, qty: number) => setD((x) => ({ ...x, items: x.items.map((i) => (i.productId === id ? { ...i, qty: Math.max(1, Math.floor(qty) || 1) } : i)) }));
  const save = (confirm: boolean) => { if (notify(saveSale({ ...d, date: new Date(d.date).toISOString(), confirm }), confirm ? "Venta confirmada: inventario actualizado" : "Venta guardada como borrador")) onClose(); };
  return (
    <SidePanel open onClose={onClose} title={d.id ? "Editar venta" : "Nueva venta"} description="Al confirmar se descuentan los componentes de cada receta." wide
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button variant="outline" onClick={() => save(false)}>Guardar borrador</Button><Button disabled={!d.items.length || missing.length > 0} onClick={() => save(true)}>Confirmar venta</Button></>}>
      <div className="grid grid-cols-3 gap-2">
        {products.map((p) => (
          <button key={p.id} onClick={() => add(p.id)} className="rounded-md border bg-card p-3 text-left transition hover:border-primary hover:bg-accent">
            <div className="text-sm font-semibold">{p.name}</div><div className="text-xs text-muted-foreground">{fmtCOP(p.price ?? 0)}</div>
          </button>
        ))}
      </div>
      <div className="rounded-md border">
        <DataTable head={["Producto", "Cantidad", "Precio", "Subtotal", ""]} empty={!d.items.length}>
          {d.items.map((i) => (
            <tr key={i.productId}>
              <td className="font-medium">{i.name}</td>
              <td><div className="flex items-center gap-1">
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(i.productId, i.qty - 1)}><Minus className="h-3 w-3" /></Button>
                <Input type="number" min={1} className="h-7 w-14 text-center" value={i.qty} onChange={(e) => setQty(i.productId, Number(e.target.value))} />
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(i.productId, i.qty + 1)}><Plus className="h-3 w-3" /></Button>
              </div></td>
              <td>{fmtCOP(i.price)}</td>
              <td className="font-semibold">{fmtCOP(i.qty * i.price)}</td>
              <td><Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Quitar" onClick={() => setD({ ...d, items: d.items.filter((x) => x.productId !== i.productId) })}><X className="h-4 w-4" /></Button></td>
            </tr>
          ))}
        </DataTable>
        <div className="flex justify-between border-t px-4 py-3 text-lg font-bold"><span>Total</span><span>{fmtCOP(total)}</span></div>
      </div>
      {missing.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <div className="mb-1 flex items-center gap-2 font-semibold"><AlertCircle className="h-4 w-4" />No hay componentes suficientes</div>
          {missing.map((m) => <div key={m.productId}>{m.product?.name}: requiere {fmtQty(m.need, m.product!.unit)}, faltan {fmtQty(m.missing, m.product!.unit)}</div>)}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Método de pago"><Select value={d.method} onChange={(v) => setD({ ...d, method: v as PayMethod })}><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option></Select></Field>
        <Field label="Fecha y hora"><Input type="datetime-local" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} /></Field>
      </div>
    </SidePanel>
  );
}
