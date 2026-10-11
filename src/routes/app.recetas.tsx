import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search, Pencil, Trash2, X, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore, saveRecipe, deleteRecipe, recipeCost, requirements, unitsFor, fmtCOP, fmtQty, CATEGORY_LABEL, type Recipe, type Unit } from "@/lib/store";
import { useColumnTable, type Col } from "@/components/col-table";
import { PageHeader, Panel, DataTable, SidePanel, FormFooter, Confirm, Field, Select, Tag, notify } from "@/components/kit";

export const Route = createFileRoute("/app/recetas")({
  head: () => ({ meta: [{ title: "Recetas — Synthex Kitchen" }, { name: "description", content: "Recetas, ingredientes y costos de preparaciones y pizzas." }, { property: "og:title", content: "Recetas — Synthex Kitchen" }, { property: "og:description", content: "Costeo de recetas de la pizzería." }] }),
  component: Recetas,
});

type Draft = Omit<Recipe, "id"> & { id?: string };

function Recetas() {
  const s = useStore()!;
  const [edit, setEdit] = useState<Draft | null>(null);
  const [del, setDel] = useState<Recipe | null>(null);
  const prod = (id: string) => s.products.find((p) => p.id === id);
  const cols: Col<Recipe>[] = [
    { label: "Receta", type: "text", value: (r) => r.name },
    { label: "Producto resultante", type: "select", value: (r) => prod(r.productId)?.name ?? "" },
    { label: "Tipo", type: "select", value: (r) => { const p = prod(r.productId); return p ? CATEGORY_LABEL[p.category] : ""; } },
    { label: "Rendimiento", type: "number", value: (r) => r.yield },
    { label: "Ingredientes", type: "number", value: (r) => r.ingredients.length },
    { label: "Costo receta", type: "number", value: (r) => recipeCost(s, r).total },
    { label: "Costo unitario", type: "number", value: (r) => recipeCost(s, r).perUnit },
    { label: "", type: "none" },
  ];
  const { rows, head } = useColumnTable(s.recipes, cols);

  return (
    <>
      <PageHeader title="Recetas" description="Ingredientes, rendimiento y costo de cada preparación o pizza"
        actions={<Button onClick={() => setEdit({ name: "", productId: "", yield: 1, ingredients: [{ productId: "", qty: 0, unit: "kg" }] })}><Plus className="h-4 w-4" />Nueva receta</Button>} />
      <Panel>
        <div className="flex flex-wrap gap-2 border-b p-3">
          <div className="relative min-w-56 flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Buscar receta" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select className="w-48" value={cat} onChange={setCat}><option value="">Todos los tipos</option><option value="preparacion">Preparaciones</option><option value="venta">Pizzas (venta)</option></Select>
        </div>
        <DataTable head={["Receta", "Producto resultante", "Rendimiento", "Ingredientes", "Costo receta", "Costo unitario", ""]} empty={!rows.length}>
          {rows.map((r) => {
            const p = prod(r.productId);
            const c = recipeCost(s, r);
            return (
              <tr key={r.id}>
                <td className="font-medium">{r.name}</td>
                <td>{p?.name}</td>
                <td><Tag tone={p?.category === "venta" ? "blue" : "green"}>{p ? CATEGORY_LABEL[p.category] : ""}</Tag></td>
                <td>{fmtQty(r.yield, p?.unit ?? "und")}</td>
                <td className="text-muted-foreground">{r.ingredients.length}</td>
                <td>{fmtCOP(c.total)}</td>
                <td className="font-semibold">{fmtCOP(c.perUnit)}</td>
                <td><div className="flex justify-end gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Editar" onClick={() => setEdit(structuredClone(r))}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label="Eliminar" onClick={() => setDel(r)}><Trash2 className="h-4 w-4" /></Button>
                </div></td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>
      {edit && <RecipeForm draft={edit} onClose={() => setEdit(null)} />}
      <Confirm open={!!del} onClose={() => setDel(null)} title={`¿Eliminar la receta ${del?.name}?`} description="Si el producto se vende, no podrá registrarse en ventas sin receta." label="Eliminar" danger
        onConfirm={() => del && notify(deleteRecipe(del.id), "Receta eliminada")} />
    </>
  );
}

function RecipeForm({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const s = useStore()!;
  const [d, setD] = useState<Draft>(draft);
  const [sim, setSim] = useState(10);
  const outputs = s.products.filter((p) => p.category !== "materia");
  const inputs = s.products.filter((p) => p.category !== "venta" && p.id !== d.productId);
  const out = s.products.find((p) => p.id === d.productId);
  const cost = recipeCost(s, d);
  const valid = d.ingredients.every((i) => i.productId && i.qty > 0);
  const tempState = { ...s, recipes: [...s.recipes.filter((r) => r.id !== "__sim"), { ...d, id: "__sim" } as Recipe] };
  const reqs = valid && d.yield > 0 ? requirements(tempState, "__sim", sim) : [];
  const dupes = new Set(d.ingredients.map((i) => i.productId).filter((id, i, a) => id && a.indexOf(id) !== i));

  const setIng = (idx: number, patch: Partial<Draft["ingredients"][number]>) => setD((x) => ({ ...x, ingredients: x.ingredients.map((i, j) => (j === idx ? { ...i, ...patch } : i)) }));
  const save = () => { if (notify(saveRecipe(d), d.id ? "Receta actualizada" : "Receta creada")) onClose(); };

  return (
    <SidePanel open onClose={onClose} title={d.id ? "Editar receta" : "Nueva receta"} description="Las cantidades se convierten automáticamente (g↔kg, ml↔l)." wide footer={<FormFooter onCancel={onClose} onSave={save} />}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre *"><Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} maxLength={80} /></Field>
        <Field label="Producto resultante *">
          <Select value={d.productId} onChange={(v) => { const p = s.products.find((x) => x.id === v); setD({ ...d, productId: v, name: d.name || p?.name || "" }); }}>
            <option value="">Seleccionar…</option>{outputs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label={`Cantidad producida por receta${out ? ` (${out.unit})` : ""} *`}><Input type="number" min={0} step="any" value={d.yield} onChange={(e) => setD({ ...d, yield: Number(e.target.value) })} /></Field>
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <div className="text-[11px] text-muted-foreground">Costo estimado</div>
          <div className="font-bold">{fmtCOP(cost.total)} <span className="text-xs font-normal text-muted-foreground">· {fmtCOP(cost.perUnit)} / {out?.unit ?? "und"}</span></div>
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between"><h4 className="text-sm font-semibold">Ingredientes</h4>
          <Button size="sm" variant="outline" onClick={() => setD({ ...d, ingredients: [...d.ingredients, { productId: "", qty: 0, unit: "kg" }] })}><Plus className="h-3.5 w-3.5" />Agregar</Button></div>
        <div className="space-y-2">
          {d.ingredients.map((i, idx) => {
            const p = s.products.find((x) => x.id === i.productId);
            return (
              <div key={idx} className="grid grid-cols-[1fr_100px_80px_32px] items-center gap-2">
                <Select className={dupes.has(i.productId) ? "border-destructive" : ""} value={i.productId} onChange={(v) => { const np = s.products.find((x) => x.id === v); setIng(idx, { productId: v, unit: np ? unitsFor(np.unit)[0]! : "kg" }); }}>
                  <option value="">Seleccionar insumo…</option>{inputs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </Select>
                <Input type="number" min={0} step="any" className={i.qty <= 0 ? "border-destructive" : ""} value={i.qty} onChange={(e) => setIng(idx, { qty: Number(e.target.value) })} />
                <Select value={i.unit} onChange={(v) => setIng(idx, { unit: v as Unit })}>{(p ? unitsFor(p.unit) : ["kg", "g"]).map((u) => <option key={u}>{u}</option>)}</Select>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Quitar" onClick={() => setD({ ...d, ingredients: d.ingredients.filter((_, j) => j !== idx) })}><X className="h-4 w-4" /></Button>
              </div>
            );
          })}
          {dupes.size > 0 && <p className="text-xs text-destructive">Hay ingredientes repetidos.</p>}
        </div>
      </div>
      <div className="rounded-md border">
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
          <span className="text-sm font-semibold">Disponibilidad para producir</span>
          <div className="flex items-center gap-2"><Input type="number" min={1} className="h-8 w-20" value={sim} onChange={(e) => setSim(Number(e.target.value))} /><span className="text-xs text-muted-foreground">{out?.unit ?? "und"}</span></div>
        </div>
        {reqs.length ? (
          <ul className="divide-y text-sm">
            {reqs.map((r) => (
              <li key={r.productId} className="flex items-center justify-between px-3 py-2">
                <span className="flex items-center gap-2">{r.missing > 0 ? <AlertCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-primary" />}{r.product?.name}</span>
                <span className="text-xs">Requiere <b>{fmtQty(r.need, r.product!.unit)}</b> · disp. {fmtQty(r.available, r.product!.unit)}{r.missing > 0 && <span className="ml-1 font-semibold text-destructive">· faltan {fmtQty(r.missing, r.product!.unit)}</span>}</span>
              </li>
            ))}
          </ul>
        ) : <p className="p-3 text-xs text-muted-foreground">Completa los ingredientes para calcular la disponibilidad.</p>}
      </div>
    </SidePanel>
  );
}
