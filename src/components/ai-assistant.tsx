import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SidePanel, Tag, Empty } from "@/components/kit";
import { useStore, requirements, saveOrder, fmtQty, type State } from "@/lib/store";
import { suggestProduction, type AiContext, type AiSuggestion } from "@/lib/ai-production.functions";
import { ORDER_LABEL } from "@/components/badges";

function buildContext(s: State): AiContext {
  const since = Date.now() - 7 * 86400000;
  return {
    fecha: new Date().toISOString().slice(0, 10),
    preparaciones: s.products.filter((p) => p.category === "preparacion" && p.active).map((p) => {
      const used = s.movements.filter((m) => m.productId === p.id && new Date(m.date).getTime() >= since && (m.refType === "venta" || m.refType === "anulacion"))
        .reduce((a, m) => a - m.qty, 0);
      const r = s.recipes.find((x) => x.productId === p.id);
      return {
        productId: p.id, nombre: p.name, unidad: p.unit, stock: p.stock, minimo: p.min,
        consumoDiarioPromedio7d: Math.round((Math.max(0, used) / 7) * 1000) / 1000,
        receta: r ? { rendimiento: r.yield, ingredientes: r.ingredients.map((i) => { const ip = s.products.find((x) => x.id === i.productId); return { nombre: ip?.name ?? "?", cantidad: i.qty, unidad: i.unit, stockDisponible: ip?.stock ?? 0, unidadStock: ip?.unit ?? i.unit }; }) } : null,
        ordenesAbiertas: s.orders.filter((o) => r && o.recipeId === r.id && ["borrador", "pendiente", "en_produccion"].includes(o.status)).map((o) => ({ codigo: o.code, cantidad: o.qty, estado: ORDER_LABEL[o.status] })),
      };
    }),
  };
}

const PRIO = { alta: "red", media: "amber", baja: "green" } as const;
type Item = AiSuggestion & { created?: boolean };

export function AiAssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const [st, setSt] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [err, setErr] = useState("");
  const [resumen, setResumen] = useState("");
  const [items, setItems] = useState<Item[]>([]);

  const run = async () => {
    if (!s) return;
    setSt("loading"); setErr("");
    try {
      const r = await suggestProduction({ data: buildContext(s) });
      if (!r.ok) { setErr(r.error); setSt("error"); return; }
      setResumen(r.resumen); setItems(r.sugerencias); setSt("done");
    } catch {
      setErr("No se pudo conectar con el asistente de IA."); setSt("error");
    }
  };
  useEffect(() => { if (open && s && st === "idle") void run(); }, [open, s]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!open) setSt("idle"); }, [open]);

  const info = (it: Item) => {
    const recipe = s?.recipes.find((r) => r.productId === it.productId);
    const product = s?.products.find((p) => p.id === it.productId);
    const reqs = s && recipe && it.qty > 0 ? requirements(s, recipe.id, it.qty) : [];
    const viable = !!recipe && it.qty > 0 && reqs.every((r) => r.missing === 0);
    return { recipe, product, reqs, viable };
  };
  const create = (it: Item, i: number, silent = false) => {
    const { recipe, viable } = info(it);
    if (!recipe || !viable || it.created) return false;
    const r = saveOrder({ recipeId: recipe.id, qty: it.qty, date: new Date().toISOString(), status: "borrador" });
    if (!r.ok) { toast.error(r.error); return false; }
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, created: true } : x)));
    if (!silent) toast.success("Orden creada en borrador");
    return true;
  };
  const createAll = () => {
    const n = items.reduce((a, it, i) => a + (create(it, i, true) ? 1 : 0), 0);
    if (n) toast.success(`${n} órdenes creadas en borrador`); else toast.error("No hay sugerencias viables para crear");
  };
  const viableCount = items.filter((it) => !it.created && info(it).viable).length;

  return (
    <SidePanel open={open} onClose={onClose} title="Asistente de producción IA" description="Sugerencias de qué preparar hoy según stock, recetas y ventas recientes." wide
      footer={<>
        <Button variant="outline" onClick={onClose}>Cerrar</Button>
        <Button variant="outline" onClick={run} disabled={st === "loading"}><RefreshCw className="h-4 w-4" />Regenerar</Button>
        <Button onClick={createAll} disabled={st !== "done" || !viableCount}>Crear todas las viables ({viableCount})</Button>
      </>}>
      <p className="rounded-md border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">Sugerencias generadas con IA. Revisa antes de crear la orden; crear la orden no mueve inventario.</p>
      {st === "loading" && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="h-4 w-4 animate-pulse text-primary" />Analizando inventario y ventas…</p>
          <Skeleton className="h-16 w-full" /><Skeleton className="h-36 w-full" /><Skeleton className="h-36 w-full" />
        </div>
      )}
      {st === "error" && (
        <div className="flex flex-col items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center text-sm">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <span>{err}</span>
          <Button variant="outline" size="sm" onClick={run}><RefreshCw className="h-4 w-4" />Reintentar</Button>
        </div>
      )}
      {st === "done" && (
        <>
          {resumen && <div className="rounded-md border p-3 text-sm"><div className="mb-1 text-xs font-semibold text-muted-foreground">Resumen</div>{resumen}</div>}
          {!items.length ? <Empty text="No hace falta producir nada hoy" /> : items.map((it, i) => {
            const { product, reqs, viable, recipe } = info(it);
            const missing = reqs.filter((r) => r.missing > 0);
            return (
              <div key={i} className="rounded-md border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{product?.name ?? "Producto"}</span>
                    <Tag tone={PRIO[it.prioridad]}>Prioridad {it.prioridad}</Tag>
                    {!viable && <Tag tone="red">Faltan insumos</Tag>}
                    {it.created && <Tag tone="dark">Orden creada</Tag>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={0} step="any" className="h-8 w-24" value={it.qty} disabled={it.created}
                      onChange={(e) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} />
                    <span className="text-xs text-muted-foreground">{product?.unit}</span>
                  </div>
                </div>
                <p className="px-3 py-2 text-sm text-muted-foreground">{it.razon}</p>
                {!recipe && <p className="px-3 pb-2 text-xs text-destructive">Este producto no tiene receta definida.</p>}
                {reqs.length > 0 && (
                  <ul className="divide-y border-t text-sm">
                    {reqs.map((r) => (
                      <li key={r.productId} className="flex items-center justify-between px-3 py-1.5">
                        <span className="flex items-center gap-2">{r.missing > 0 ? <AlertCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-primary" />}{r.product?.name}</span>
                        <span className="text-xs">Requiere <b>{fmtQty(r.need, r.product!.unit)}</b> · disp. {fmtQty(r.available, r.product!.unit)}{r.missing > 0 && <b className="ml-1 text-destructive">· faltan {fmtQty(r.missing, r.product!.unit)}</b>}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {missing.length > 0 && <p className="border-t px-3 py-2 text-xs text-destructive">Faltan: {missing.map((m) => `${m.product?.name} (${fmtQty(m.missing, m.product!.unit)})`).join(", ")}</p>}
                <div className="flex justify-end border-t bg-muted/30 px-3 py-2">
                  <Button size="sm" disabled={!viable || it.created} onClick={() => create(it, i)}>Crear orden en borrador</Button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </SidePanel>
  );
}
