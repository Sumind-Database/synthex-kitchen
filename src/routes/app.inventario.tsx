import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Eye, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useStore, saveProduct, deleteProduct, toggleProduct, productLinked, productCost, stockStatus,
  fmtCOP, fmtQty, fmtDateTime, CATEGORY_LABEL, type Product, type Category, type BaseUnit,
} from "@/lib/store";
import { PageHeader, Panel, DataTable, SidePanel, FormFooter, Confirm, Field, Select, notify } from "@/components/kit";
import { StockBadge, MoveBadge } from "@/components/badges";

export const Route = createFileRoute("/app/inventario")({
  head: () => ({ meta: [{ title: "Inventario — PizzaFlow" }, { name: "description", content: "Productos, existencias y estados de stock." }, { property: "og:title", content: "Inventario — PizzaFlow" }, { property: "og:description", content: "Control de existencias de la pizzería." }] }),
  component: Inventario,
});

type Draft = Omit<Product, "id"> & { id?: string };
const blank: Draft = { name: "", sku: "", category: "materia", unit: "kg", stock: 0, min: 0, cost: 0, price: undefined, active: true };

function Inventario() {
  const s = useStore()!;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [st, setSt] = useState("");
  const [lvl, setLvl] = useState("");
  const [edit, setEdit] = useState<Draft | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [del, setDel] = useState<Product | null>(null);
  const [blocked, setBlocked] = useState<{ p: Product; why: string } | null>(null);

  const rows = useMemo(() => s.products.filter((p) => {
    if (q && !`${p.name} ${p.sku}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (cat && p.category !== cat) return false;
    if (st && (st === "activo") !== p.active) return false;
    if (lvl && stockStatus(p) !== lvl) return false;
    return true;
  }), [s.products, q, cat, st, lvl]);

  const viewed = s.products.find((p) => p.id === view);

  const onDelete = (p: Product) => {
    const why = productLinked(s, p.id);
    if (why) setBlocked({ p, why }); else setDel(p);
  };

  return (
    <>
      <PageHeader title="Inventario" description="Materias primas, preparaciones y productos de venta" actions={<Button onClick={() => setEdit({ ...blank })}><Plus className="h-4 w-4" />Nuevo producto</Button>} />
      <Panel>
        <div className="flex flex-wrap gap-2 border-b p-3">
          <div className="relative min-w-56 flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Buscar por nombre o SKU" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select className="w-44" value={cat} onChange={setCat}><option value="">Todas las categorías</option>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
          <Select className="w-36" value={st} onChange={setSt}><option value="">Todos los estados</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></Select>
          <Select className="w-40" value={lvl} onChange={setLvl}><option value="">Todo nivel de stock</option><option value="optimo">Óptimo</option><option value="bajo">Stock bajo</option><option value="agotado">Agotado</option></Select>
        </div>
        <DataTable head={["Producto", "SKU", "Categoría", "Stock", "Mínimo", "Costo unit.", "Precio venta", "Estado", ""]} empty={!rows.length}>
          {rows.map((p) => (
            <tr key={p.id} className={p.active ? "" : "opacity-60"}>
              <td className="font-medium">{p.name}</td>
              <td className="text-muted-foreground">{p.sku}</td>
              <td>{CATEGORY_LABEL[p.category]}</td>
              <td className="font-semibold">{p.category === "venta" ? "—" : fmtQty(p.stock, p.unit)}</td>
              <td className="text-muted-foreground">{p.category === "venta" ? "—" : fmtQty(p.min, p.unit)}</td>
              <td>{fmtCOP(productCost(s, p))}</td>
              <td>{p.price ? fmtCOP(p.price) : "—"}</td>
              <td><StockBadge p={p} /></td>
              <td>
                <div className="flex justify-end gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Ver" onClick={() => setView(p.id)}><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Editar" onClick={() => setEdit({ ...p })}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label="Eliminar" onClick={() => onDelete(p)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      {edit && <ProductForm draft={edit} onClose={() => setEdit(null)} />}

      <SidePanel open={!!viewed} onClose={() => setView(null)} title={viewed?.name ?? ""} description={viewed ? `${viewed.sku} · ${CATEGORY_LABEL[viewed.category]}` : ""} wide
        footer={viewed && <><Button variant="outline" onClick={() => setView(null)}>Cerrar</Button><Button onClick={() => { setEdit({ ...viewed }); setView(null); }}>Editar</Button></>}>
        {viewed && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[["Stock actual", viewed.category === "venta" ? "Bajo pedido" : fmtQty(viewed.stock, viewed.unit)], ["Stock mínimo", fmtQty(viewed.min, viewed.unit)], ["Costo unitario", fmtCOP(productCost(s, viewed))]].map(([l, v]) => (
                <div key={l} className="rounded-md border p-3"><div className="text-[11px] text-muted-foreground">{l}</div><div className="font-semibold">{v}</div></div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm">Estado: <StockBadge p={viewed} /></div>
            <h4 className="pt-2 text-sm font-semibold">Historial de movimientos</h4>
            <div className="rounded-md border">
              <DataTable head={["Fecha", "Tipo", "Cantidad", "Anterior", "Posterior", "Ref."]} empty={!s.movements.some((m) => m.productId === viewed.id)}>
                {s.movements.filter((m) => m.productId === viewed.id).map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap text-muted-foreground">{fmtDateTime(m.date)}</td>
                    <td><MoveBadge t={m.type} /></td>
                    <td className={m.qty < 0 ? "text-destructive" : "text-chart-2"}>{m.qty > 0 ? "+" : ""}{fmtQty(m.qty, viewed.unit)}</td>
                    <td>{fmtQty(m.before, viewed.unit)}</td>
                    <td>{fmtQty(m.after, viewed.unit)}</td>
                    <td className="text-muted-foreground">{m.refCode}</td>
                  </tr>
                ))}
              </DataTable>
            </div>
          </>
        )}
      </SidePanel>

      <Confirm open={!!del} onClose={() => setDel(null)} title={`¿Eliminar ${del?.name}?`} description="Esta acción no se puede deshacer." label="Eliminar" danger
        onConfirm={() => del && notify(deleteProduct(del.id), "Producto eliminado")} />
      <Confirm open={!!blocked} onClose={() => setBlocked(null)} title="No es posible eliminar"
        description={blocked ? `${blocked.p.name} ${blocked.why}, por lo que debe conservarse para mantener la trazabilidad. ¿Deseas ${blocked.p.active ? "desactivarlo" : "activarlo"}?` : ""}
        label={blocked?.p.active ? "Desactivar" : "Activar"}
        onConfirm={() => { if (blocked) { toggleProduct(blocked.p.id); notify({ ok: true }, blocked.p.active ? "Producto desactivado" : "Producto activado"); } }} />
    </>
  );
}

function ProductForm({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const [d, setD] = useState<Draft>(draft);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const save = () => {
    if (d.category === "venta" && !(d.price && d.price > 0)) { notify({ ok: false, error: "Los productos de venta requieren precio" }, ""); return; }
    if (notify(saveProduct(d), d.id ? "Producto actualizado" : "Producto creado")) onClose();
  };
  return (
    <SidePanel open onClose={onClose} title={d.id ? "Editar producto" : "Nuevo producto"} description="Los cambios de stock quedan registrados como ajuste."
      footer={<FormFooter onCancel={onClose} onSave={save} extra={d.id ? <Button variant="outline" onClick={() => set("active", !d.active)}><Power className="h-4 w-4" />{d.active ? "Desactivar" : "Activar"}</Button> : undefined} />}>
      <Field label="Nombre *"><Input value={d.name} onChange={(e) => set("name", e.target.value)} maxLength={80} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU *"><Input value={d.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())} maxLength={20} /></Field>
        <Field label="Categoría"><Select value={d.category} onChange={(v) => set("category", v as Category)}>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Unidad de medida"><Select value={d.unit} onChange={(v) => set("unit", v as BaseUnit)}><option value="kg">Kilogramo (kg)</option><option value="l">Litro (l)</option><option value="und">Unidad (und)</option></Select></Field>
        <Field label="Estado"><Select value={d.active ? "1" : "0"} onChange={(v) => set("active", v === "1")}><option value="1">Activo</option><option value="0">Inactivo</option></Select></Field>
        {d.category !== "venta" && <>
          <Field label="Stock actual"><Input type="number" min={0} step="any" value={d.stock} onChange={(e) => set("stock", num(e.target.value))} /></Field>
          <Field label="Stock mínimo"><Input type="number" min={0} step="any" value={d.min} onChange={(e) => set("min", num(e.target.value))} /></Field>
          <Field label="Costo unitario (COP)"><Input type="number" min={0} value={d.cost} onChange={(e) => set("cost", num(e.target.value))} /></Field>
        </>}
        <Field label={d.category === "venta" ? "Precio de venta *" : "Precio de venta (opcional)"}><Input type="number" min={0} value={d.price ?? ""} onChange={(e) => set("price", e.target.value === "" ? undefined : Number(e.target.value))} /></Field>
      </div>
      {d.category === "venta" && <p className="text-xs text-muted-foreground">El costo de un producto de venta se calcula desde su receta. Su stock no se lleva: al venderse se descuentan sus componentes.</p>}
    </SidePanel>
  );
}
