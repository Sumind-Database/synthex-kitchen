import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SlidersHorizontal, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore, manualAdjust, fmtQty, fmtDateTime, type MoveType } from "@/lib/store";
import { PageHeader, Panel, DataTable, SidePanel, FormFooter, Confirm, Field, Select, Tag, notify } from "@/components/kit";
import { MoveBadge } from "@/components/badges";

export const Route = createFileRoute("/app/movimientos")({
  head: () => ({ meta: [{ title: "Movimientos — PizzaFlow" }, { name: "description", content: "Libro de movimientos de inventario con trazabilidad." }, { property: "og:title", content: "Movimientos — PizzaFlow" }, { property: "og:description", content: "Entradas, salidas y ajustes de inventario." }] }),
  component: Movimientos,
});

const REF = { produccion: "Producción", venta: "Venta", ajuste: "Ajuste manual", anulacion: "Anulación" } as const;

function Movimientos() {
  const s = useStore()!;
  const [prod, setProd] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [adj, setAdj] = useState<{ productId: string; type: MoveType; qty: number; reason: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const stockable = s.products.filter((p) => p.category !== "venta");
  const rows = s.movements.filter((m) => (!prod || m.productId === prod) && (!type || m.type === type) && (!from || m.date.slice(0, 10) >= from) && (!to || m.date.slice(0, 10) <= to));
  const P = (id: string) => s.products.find((p) => p.id === id);
  const sel = adj && P(adj.productId);

  return (
    <>
      <PageHeader title="Movimientos" description="Libro de entradas, salidas y ajustes de inventario" actions={<Button onClick={() => setAdj({ productId: "", type: "entrada", qty: 0, reason: "" })}><SlidersHorizontal className="h-4 w-4" />Ajuste manual</Button>} />
      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Select className="w-52" value={prod} onChange={setProd}><option value="">Todos los productos</option>{stockable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
          <Select className="w-36" value={type} onChange={setType}><option value="">Todos los tipos</option><option value="entrada">Entrada</option><option value="salida">Salida</option><option value="ajuste">Ajuste</option></Select>
          <span className="text-xs text-muted-foreground">Desde</span><Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-xs text-muted-foreground">Hasta</span><Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          {(prod || type || from || to) && <Button variant="ghost" size="sm" onClick={() => { setProd(""); setType(""); setFrom(""); setTo(""); }}>Limpiar</Button>}
        </div>
        <DataTable head={["Fecha y hora", "Producto", "Tipo", "Cantidad", "Anterior", "Posterior", "Motivo", "Documento", ""]} empty={!rows.length}>
          {rows.map((m) => {
            const p = P(m.productId);
            const u = p?.unit ?? "und";
            return (
              <tr key={m.id}>
                <td className="whitespace-nowrap text-muted-foreground">{fmtDateTime(m.date)}</td>
                <td className="font-medium">{p?.name ?? "—"}</td>
                <td><MoveBadge t={m.type} /></td>
                <td className={m.qty < 0 ? "font-semibold text-destructive" : "font-semibold text-chart-2"}>{m.qty > 0 ? "+" : ""}{fmtQty(m.qty, u)}</td>
                <td>{fmtQty(m.before, u)}</td>
                <td>{fmtQty(m.after, u)}</td>
                <td className="max-w-56 truncate text-muted-foreground">{m.reason}</td>
                <td className="whitespace-nowrap"><Tag tone="gray">{REF[m.refType]}</Tag> <span className="ml-1 text-xs">{m.refCode}</span></td>
                <td title="Movimiento confirmado: no editable"><Lock className="h-3.5 w-3.5 text-muted-foreground" /></td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>

      {adj && (
        <SidePanel open onClose={() => setAdj(null)} title="Ajuste manual de inventario" description="Requiere confirmación y queda registrado en el libro."
          footer={<FormFooter onCancel={() => setAdj(null)} onSave={() => { if (!adj.productId) { notify({ ok: false, error: "Selecciona un producto" }, ""); return; } if (!adj.reason.trim()) { notify({ ok: false, error: "El motivo es obligatorio" }, ""); return; } setConfirm(true); }} />}>
          <Field label="Producto *"><Select value={adj.productId} onChange={(v) => setAdj({ ...adj, productId: v })}><option value="">Seleccionar…</option>{stockable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          {sel && <p className="text-xs text-muted-foreground">Stock actual: <b>{fmtQty(sel.stock, sel.unit)}</b></p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo"><Select value={adj.type} onChange={(v) => setAdj({ ...adj, type: v as MoveType })}><option value="entrada">Entrada (sumar)</option><option value="salida">Salida (restar)</option><option value="ajuste">Ajuste (fijar stock)</option></Select></Field>
            <Field label={`${adj.type === "ajuste" ? "Stock final" : "Cantidad"}${sel ? ` (${sel.unit})` : ""} *`}><Input type="number" min={0} step="any" value={adj.qty} onChange={(e) => setAdj({ ...adj, qty: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Motivo *"><Input value={adj.reason} maxLength={120} placeholder="Ej. Compra a proveedor, merma, conteo físico" onChange={(e) => setAdj({ ...adj, reason: e.target.value })} /></Field>
        </SidePanel>
      )}
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="¿Registrar el ajuste?" description={sel && adj ? `${sel.name}: ${adj.type} de ${fmtQty(adj.qty, sel.unit)}. Motivo: ${adj.reason}` : ""}
        onConfirm={() => { if (adj && notify(manualAdjust(adj.productId, adj.type, adj.qty, adj.reason), "Ajuste registrado")) setAdj(null); }} />
    </>
  );
}
