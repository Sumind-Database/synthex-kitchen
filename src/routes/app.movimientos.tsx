import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SlidersHorizontal, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore, manualAdjust, fmtQty, fmtDateTime, type MoveType } from "@/lib/store";
import { useColumnTable, type Col } from "@/components/col-table";
import { PageHeader, Panel, DataTable, SidePanel, FormFooter, Confirm, Field, Select, Tag, notify } from "@/components/kit";
import { MoveBadge } from "@/components/badges";

export const Route = createFileRoute("/app/movimientos")({
  head: () => ({ meta: [{ title: "Movimientos — Synthex Kitchen" }, { name: "description", content: "Libro de movimientos de inventario con trazabilidad." }, { property: "og:title", content: "Movimientos — Synthex Kitchen" }, { property: "og:description", content: "Entradas, salidas y ajustes de inventario." }] }),
  component: Movimientos,
});

const MT: Record<string, string> = { entrada: "Entrada", salida: "Salida", ajuste: "Ajuste" };
const REF = { produccion: "Producción", venta: "Venta", ajuste: "Ajuste manual", anulacion: "Anulación" } as const;

function Movimientos() {
  const s = useStore()!;
  const [adj, setAdj] = useState<{ productId: string; type: MoveType; qty: number; reason: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const stockable = s.products.filter((p) => p.category !== "venta");
  const PN = (id: string) => s.products.find((p) => p.id === id);
  const cols: Col<(typeof s.movements)[number]>[] = [
    { label: "Fecha y hora", type: "date", value: (m) => m.date },
    { label: "Producto", type: "select", value: (m) => PN(m.productId)?.name ?? "—" },
    { label: "Tipo", type: "select", value: (m) => MT[m.type] ?? m.type },
    { label: "Cantidad", type: "number", value: (m) => m.qty },
    { label: "Anterior", type: "number", value: (m) => m.before },
    { label: "Posterior", type: "number", value: (m) => m.after },
    { label: "Motivo", type: "text", value: (m) => m.reason },
    { label: "Documento", type: "select", value: (m) => REF[m.refType] },
    { label: "", type: "none" },
  ];
  const { rows, head } = useColumnTable(s.movements, cols);
  const P = (id: string) => s.products.find((p) => p.id === id);
  const sel = adj && P(adj.productId);

  return (
    <>
      <PageHeader title="Movimientos" description="Libro de entradas, salidas y ajustes de inventario" actions={<Button onClick={() => setAdj({ productId: "", type: "entrada", qty: 0, reason: "" })}><SlidersHorizontal className="h-4 w-4" />Ajuste manual</Button>} />
      <Panel>
        <DataTable head={head} empty={!rows.length}>
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
