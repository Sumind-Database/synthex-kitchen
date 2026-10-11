import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type Category = "materia" | "preparacion" | "venta";
export type BaseUnit = "kg" | "l" | "und";
export type Unit = "kg" | "g" | "l" | "ml" | "und";
export const CATEGORY_LABEL: Record<Category, string> = {
  materia: "Materia prima",
  preparacion: "Preparación",
  venta: "Producto de venta",
};

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: Category;
  unit: BaseUnit;
  stock: number;
  min: number;
  cost: number;
  price?: number | undefined;
  active: boolean;
}
export interface Ingredient {
  productId: string;
  qty: number;
  unit: Unit;
}
export interface Recipe {
  id: string;
  name: string;
  productId: string;
  yield: number;
  ingredients: Ingredient[];
}
export type OrderStatus = "borrador" | "pendiente" | "en_produccion" | "completada" | "cancelada";
export interface OrderLine {
  productId: string;
  qty: number; // base unit
}
export interface ProductionOrder {
  id: string;
  code: string;
  date: string;
  recipeId: string;
  qty: number;
  status: OrderStatus;
  consumed?: OrderLine[];
  produced?: number;
  completedAt?: string;
}
export type SaleStatus = "borrador" | "confirmada" | "anulada";
export type PayMethod = "Efectivo" | "Tarjeta" | "Transferencia";
export interface SaleItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
}
export interface Sale {
  id: string;
  number: string;
  date: string;
  items: SaleItem[];
  method: PayMethod;
  status: SaleStatus;
  total: number;
}
export type MoveType = "entrada" | "salida" | "ajuste";
export type RefType = "produccion" | "venta" | "ajuste" | "anulacion";
export interface Movement {
  id: string;
  date: string;
  productId: string;
  type: MoveType;
  qty: number; // signed delta
  before: number;
  after: number;
  reason: string;
  refType: RefType;
  refId?: string | undefined;
  refCode: string;
}
export interface State {
  products: Product[];
  recipes: Recipe[];
  orders: ProductionOrder[];
  sales: Sale[];
  movements: Movement[];
  seq: { order: number; sale: number; adj: number };
}
export type Result = { ok: true } | { ok: false; error: string };

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const round = (n: number) => Math.round(n * 10000) / 10000;

// ---------- Units ----------
const FAMILY: Record<Unit, BaseUnit> = { kg: "kg", g: "kg", l: "l", ml: "l", und: "und" };
const FACTOR: Record<Unit, number> = { kg: 1, g: 0.001, l: 1, ml: 0.001, und: 1 };
export const unitsFor = (b: BaseUnit): Unit[] => (b === "kg" ? ["kg", "g"] : b === "l" ? ["l", "ml"] : ["und"]);
export function toBase(qty: number, unit: Unit, base: BaseUnit): number {
  if (FAMILY[unit] !== base) throw new Error(`Unidad ${unit} incompatible con ${base}`);
  return round(qty * FACTOR[unit]);
}

// ---------- Calculations ----------
export function stockStatus(p: Product): "optimo" | "bajo" | "agotado" | "na" {
  if (p.category === "venta") return "na";
  if (p.stock <= 0) return "agotado";
  if (p.stock <= p.min) return "bajo";
  return "optimo";
}
export function requirements(s: State, recipeId: string, qty: number) {
  const r = s.recipes.find((x) => x.id === recipeId);
  if (!r) return [];
  const factor = qty / r.yield;
  return r.ingredients.map((i) => {
    const p = s.products.find((x) => x.id === i.productId);
    const need = p ? round(toBase(i.qty, i.unit, p.unit) * factor) : 0;
    return { product: p, productId: i.productId, need, available: p?.stock ?? 0, missing: Math.max(0, round(need - (p?.stock ?? 0))) };
  });
}
export function recipeCost(s: State, r: Pick<Recipe, "ingredients" | "yield">) {
  const total = r.ingredients.reduce((acc, i) => {
    const p = s.products.find((x) => x.id === i.productId);
    if (!p) return acc;
    try {
      return acc + toBase(i.qty, i.unit, p.unit) * p.cost;
    } catch {
      return acc;
    }
  }, 0);
  return { total, perUnit: r.yield > 0 ? total / r.yield : 0 };
}
export function productCost(s: State, p: Product) {
  if (p.category === "venta") {
    const r = s.recipes.find((x) => x.productId === p.id);
    return r ? recipeCost(s, r).perUnit : p.cost;
  }
  return p.cost;
}
export function productLinked(s: State, id: string): string | null {
  if (s.movements.some((m) => m.productId === id)) return "tiene movimientos de inventario registrados";
  if (s.recipes.some((r) => r.productId === id || r.ingredients.some((i) => i.productId === id)))
    return "está vinculado a una o más recetas";
  if (s.sales.some((x) => x.items.some((i) => i.productId === id))) return "aparece en ventas registradas";
  return null;
}

// ---------- Store (Lovable Cloud) ----------
// Server is the source of truth: every action validates + updates local state optimistically,
// then calls a database function that re-validates and applies stock atomically, then reloads.
let state: State | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
export async function refresh() {
  const { data, error } = await supabase.rpc("sk_get_state");
  if (error) { toast.error("No se pudo cargar la información: " + error.message); return; }
  state = data as unknown as State;
  listeners.forEach((l) => l());
}
function load(): State | null {
  if (!state && !loading && typeof window !== "undefined") loading = refresh().finally(() => { loading = null; });
  return state;
}
function commit(next: State) {
  state = next;
  listeners.forEach((l) => l());
}
let queue: Promise<unknown> = Promise.resolve();
function sync(fn: string, args: Record<string, unknown>) {
  // serialize writes so operations reach the server in the order they were made
  queue = queue.then(async () => {
    const { error } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)(fn, args);
    if (error) toast.error(error.message);
    await refresh();
  });
}
export function useStore(): State | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => null,
  );
}
export function resetData() {
  sync("sk_reset_demo", {});
}

// apply stock deltas atomically on a cloned state
function applyDeltas(
  s: State,
  deltas: { productId: string; qty: number }[],
  meta: { type?: MoveType; reason: string; refType: RefType; refId?: string; refCode: string; date: string },
): State | string {
  const products = s.products.map((p) => ({ ...p }));
  const moves: Movement[] = [];
  for (const d of deltas) {
    const p = products.find((x) => x.id === d.productId);
    if (!p) return "Producto inexistente en la operación";
    const after = round(p.stock + d.qty);
    if (after < 0) return `Stock insuficiente de ${p.name}: faltan ${fmtQty(-after, p.unit)}`;
    moves.push({
      id: uid(),
      date: meta.date,
      productId: p.id,
      type: meta.type ?? (d.qty >= 0 ? "entrada" : "salida"),
      qty: round(d.qty),
      before: p.stock,
      after,
      reason: meta.reason,
      refType: meta.refType,
      refId: meta.refId,
      refCode: meta.refCode,
    });
    p.stock = after;
  }
  return { ...s, products, movements: [...moves.reverse(), ...s.movements] };
}

// ---------- Actions ----------
const cur = () => state!;

export function saveProduct(p: Omit<Product, "id"> & { id?: string }): Result {
  const s = cur();
  if (!p.name.trim() || !p.sku.trim()) return { ok: false, error: "Nombre y SKU son obligatorios" };
  if (s.products.some((x) => x.sku.toLowerCase() === p.sku.trim().toLowerCase() && x.id !== p.id))
    return { ok: false, error: "Ya existe un producto con ese SKU" };
  if (p.min < 0 || p.cost < 0 || p.stock < 0) return { ok: false, error: "Los valores no pueden ser negativos" };
  if (p.id) {
    const prev = s.products.find((x) => x.id === p.id)!;
    let next: State = { ...s, products: s.products.map((x) => (x.id === p.id ? { ...x, ...p, stock: prev.stock } as Product : x)) };
    if (prev.stock !== p.stock) {
      const r = applyDeltas(next, [{ productId: p.id, qty: p.stock - prev.stock }], {
        type: "ajuste", reason: "Ajuste desde edición de producto", refType: "ajuste", refCode: `AJ-${String(s.seq.adj + 1).padStart(4, "0")}`, date: new Date().toISOString(),
      });
      if (typeof r === "string") return { ok: false, error: r };
      next = { ...r, seq: { ...r.seq, adj: r.seq.adj + 1 } };
    }
    commit(next);
    sync("sk_save_product", { p });
  } else {
    const id = uid();
    let next: State = { ...s, products: [...s.products, { ...p, id, stock: 0, sku: p.sku.trim() } as Product] };
    if (p.stock > 0) {
      const r = applyDeltas(next, [{ productId: id, qty: p.stock }], {
        type: "entrada", reason: "Stock inicial", refType: "ajuste", refCode: `AJ-${String(s.seq.adj + 1).padStart(4, "0")}`, date: new Date().toISOString(),
      });
      if (typeof r === "string") return { ok: false, error: r };
      next = { ...r, seq: { ...r.seq, adj: r.seq.adj + 1 } };
    }
    commit(next);
    sync("sk_save_product", { p: { ...p, id } });
  }
  return { ok: true };
}
export function deleteProduct(id: string): Result {
  const s = cur();
  const why = productLinked(s, id);
  if (why) return { ok: false, error: `No se puede eliminar: ${why}. Puedes desactivarlo.` };
  commit({ ...s, products: s.products.filter((p) => p.id !== id) });
  sync("sk_delete_product", { p_id: id });
  return { ok: true };
}
export function toggleProduct(id: string) {
  const s = cur();
  const cur0 = s.products.find((p) => p.id === id);
  commit({ ...s, products: s.products.map((p) => (p.id === id ? { ...p, active: !p.active } : p)) });
  if (cur0) sync("sk_set_product_active", { p_id: id, p_active: !cur0.active });
}
export function manualAdjust(productId: string, type: MoveType, qty: number, reason: string): Result {
  const s = cur();
  const p = s.products.find((x) => x.id === productId);
  if (!p) return { ok: false, error: "Selecciona un producto" };
  if (!reason.trim()) return { ok: false, error: "El motivo es obligatorio" };
  if (type !== "ajuste" && qty <= 0) return { ok: false, error: "La cantidad debe ser mayor a cero" };
  if (type === "ajuste" && qty < 0) return { ok: false, error: "El stock final no puede ser negativo" };
  const delta = type === "entrada" ? qty : type === "salida" ? -qty : qty - p.stock;
  const code = `AJ-${String(s.seq.adj + 1).padStart(4, "0")}`;
  const r = applyDeltas(s, [{ productId, qty: delta }], { type, reason, refType: "ajuste", refCode: code, date: new Date().toISOString() });
  if (typeof r === "string") return { ok: false, error: r };
  commit({ ...r, seq: { ...r.seq, adj: r.seq.adj + 1 } });
  sync("sk_adjust", { p_product: productId, p_type: type, p_qty: qty, p_reason: reason });
  return { ok: true };
}

export function saveRecipe(r: Omit<Recipe, "id"> & { id?: string }): Result {
  const s = cur();
  if (!r.name.trim()) return { ok: false, error: "El nombre es obligatorio" };
  if (!r.productId) return { ok: false, error: "Selecciona el producto resultante" };
  if (!(r.yield > 0)) return { ok: false, error: "El rendimiento debe ser mayor a cero" };
  if (!r.ingredients.length) return { ok: false, error: "Agrega al menos un ingrediente" };
  const ids = new Set<string>();
  for (const i of r.ingredients) {
    if (!i.productId) return { ok: false, error: "Hay ingredientes sin producto" };
    if (ids.has(i.productId)) return { ok: false, error: "Hay ingredientes duplicados" };
    if (i.productId === r.productId) return { ok: false, error: "Un producto no puede ser ingrediente de sí mismo" };
    if (!(i.qty > 0)) return { ok: false, error: "Las cantidades deben ser mayores a cero" };
    ids.add(i.productId);
  }
  if (s.recipes.some((x) => x.productId === r.productId && x.id !== r.id))
    return { ok: false, error: "Ese producto ya tiene una receta" };
  const rec = { ...r, id: r.id ?? uid() } as Recipe;
  if (r.id) commit({ ...s, recipes: s.recipes.map((x) => (x.id === r.id ? rec : x)) });
  else commit({ ...s, recipes: [...s.recipes, rec] });
  sync("sk_save_recipe", { r: rec });
  return { ok: true };
}
export function deleteRecipe(id: string): Result {
  const s = cur();
  if (s.orders.some((o) => o.recipeId === id)) return { ok: false, error: "La receta tiene órdenes de producción asociadas" };
  commit({ ...s, recipes: s.recipes.filter((r) => r.id !== id) });
  sync("sk_delete_recipe", { p_id: id });
  return { ok: true };
}

export function saveOrder(o: { id?: string; recipeId: string; qty: number; date: string; status: "borrador" | "pendiente" }): Result {
  const s = cur();
  if (!o.recipeId) return { ok: false, error: "Selecciona un producto" };
  if (!(o.qty > 0)) return { ok: false, error: "La cantidad debe ser mayor a cero" };
  if (o.id) {
    const prev = s.orders.find((x) => x.id === o.id)!;
    if (!["borrador", "pendiente"].includes(prev.status)) return { ok: false, error: "Solo se editan órdenes en borrador o pendientes" };
    commit({ ...s, orders: s.orders.map((x) => (x.id === o.id ? { ...x, ...o } as ProductionOrder : x)) });
    sync("sk_save_order", { o });
  } else {
    const code = `OP-${String(s.seq.order + 1).padStart(4, "0")}`;
    const id = uid();
    commit({ ...s, seq: { ...s.seq, order: s.seq.order + 1 }, orders: [{ id, code, ...o }, ...s.orders] });
    sync("sk_save_order", { o: { ...o, id } });
  }
  return { ok: true };
}
function validateOrder(s: State, o: ProductionOrder): string | null {
  const miss = requirements(s, o.recipeId, o.qty).filter((r) => r.missing > 0);
  if (miss.length) return "Stock insuficiente: " + miss.map((m) => `${m.product?.name} (faltan ${fmtQty(m.missing, m.product!.unit)})`).join(", ");
  return null;
}
export function setOrderStatus(id: string, status: OrderStatus): Result {
  const s = cur();
  const o = s.orders.find((x) => x.id === id);
  if (!o) return { ok: false, error: "Orden no encontrada" };
  if (o.status === "completada" || o.status === "cancelada") return { ok: false, error: "La orden ya está cerrada" };
  if (status === "en_produccion" || status === "pendiente") {
    if (status === "en_produccion") {
      const e = validateOrder(s, o);
      if (e) return { ok: false, error: e };
    }
    commit({ ...s, orders: s.orders.map((x) => (x.id === id ? { ...x, status } : x)) });
    sync("sk_set_order_status", { p_id: id, p_status: status });
    return { ok: true };
  }
  if (status === "cancelada") {
    if (o.status === "en_produccion") return { ok: false, error: "Solo se cancelan borradores o pendientes" };
    commit({ ...s, orders: s.orders.map((x) => (x.id === id ? { ...x, status } : x)) });
    sync("sk_set_order_status", { p_id: id, p_status: status });
    return { ok: true };
  }
  return completeOrder(id);
}
export function completeOrder(id: string): Result {
  const s = cur();
  const o = s.orders.find((x) => x.id === id);
  if (!o) return { ok: false, error: "Orden no encontrada" };
  if (o.status === "completada") return { ok: false, error: "La orden ya fue completada" };
  if (o.status === "cancelada") return { ok: false, error: "La orden está cancelada" };
  const e = validateOrder(s, o);
  if (e) return { ok: false, error: e };
  const recipe = s.recipes.find((r) => r.id === o.recipeId)!;
  const reqs = requirements(s, o.recipeId, o.qty);
  const date = new Date().toISOString();
  const r1 = applyDeltas(s, reqs.map((r) => ({ productId: r.productId, qty: -r.need })), {
    reason: `Consumo producción ${o.code}`, refType: "produccion", refId: o.id, refCode: o.code, date,
  });
  if (typeof r1 === "string") return { ok: false, error: r1 };
  const r2 = applyDeltas(r1, [{ productId: recipe.productId, qty: o.qty }], {
    reason: `Producción terminada ${o.code}`, refType: "produccion", refId: o.id, refCode: o.code, date,
  });
  if (typeof r2 === "string") return { ok: false, error: r2 };
  commit({
    ...r2,
    orders: r2.orders.map((x) => x.id === id ? { ...x, status: "completada", consumed: reqs.map((r) => ({ productId: r.productId, qty: r.need })), produced: o.qty, completedAt: date } : x),
  });
  sync("sk_complete_order", { p_id: id });
  return { ok: true };
}
export function deleteOrder(id: string): Result {
  const s = cur();
  const o = s.orders.find((x) => x.id === id);
  if (!o || o.status !== "borrador") return { ok: false, error: "Solo se eliminan órdenes en borrador" };
  commit({ ...s, orders: s.orders.filter((x) => x.id !== id) });
  sync("sk_delete_order", { p_id: id });
  return { ok: true };
}
export function orderCost(s: State, o: ProductionOrder) {
  return requirements(s, o.recipeId, o.qty).reduce((a, r) => a + r.need * (r.product?.cost ?? 0), 0);
}

export function saleNeeds(s: State, items: { productId: string; qty: number }[]) {
  const map = new Map<string, number>();
  for (const it of items) {
    const r = s.recipes.find((x) => x.productId === it.productId);
    if (!r) continue;
    for (const req of requirements(s, r.id, it.qty)) map.set(req.productId, round((map.get(req.productId) ?? 0) + req.need));
  }
  return [...map.entries()].map(([productId, need]) => {
    const p = s.products.find((x) => x.id === productId);
    return { productId, product: p, need, available: p?.stock ?? 0, missing: Math.max(0, round(need - (p?.stock ?? 0))) };
  });
}
export function saveSale(x: { items: SaleItem[]; method: PayMethod; date: string; confirm: boolean; id?: string }): Result {
  const s = cur();
  const items = x.items.filter((i) => i.qty > 0);
  if (!items.length) return { ok: false, error: "Agrega al menos un producto" };
  for (const it of items) if (!s.recipes.some((r) => r.productId === it.productId)) return { ok: false, error: `${it.name} no tiene receta definida` };
  const total = items.reduce((a, i) => a + i.qty * i.price, 0);
  let base = s;
  let id = x.id;
  let number: string;
  if (id) {
    const prev = s.sales.find((v) => v.id === id)!;
    if (prev.status !== "borrador") return { ok: false, error: "Solo se editan ventas en borrador" };
    number = prev.number;
  } else {
    id = uid();
    number = `V-${String(s.seq.sale + 1).padStart(5, "0")}`;
    base = { ...s, seq: { ...s.seq, sale: s.seq.sale + 1 } };
  }
  const sale: Sale = { id, number, date: x.date, items, method: x.method, status: x.confirm ? "confirmada" : "borrador", total };
  if (x.confirm) {
    const miss = saleNeeds(s, items).filter((n) => n.missing > 0);
    if (miss.length) return { ok: false, error: "Faltan componentes: " + miss.map((m) => `${m.product?.name} (${fmtQty(m.missing, m.product!.unit)})`).join(", ") };
    const r = applyDeltas(base, saleNeeds(s, items).map((n) => ({ productId: n.productId, qty: -n.need })), {
      reason: `Consumo por venta ${number}`, refType: "venta", refId: id, refCode: number, date: x.date,
    });
    if (typeof r === "string") return { ok: false, error: r };
    base = r;
  }
  const exists = base.sales.some((v) => v.id === id);
  commit({ ...base, sales: exists ? base.sales.map((v) => (v.id === id ? sale : v)) : [sale, ...base.sales] });
  sync("sk_save_sale", { s: { id, date: x.date, method: x.method, items }, p_confirm: x.confirm });
  return { ok: true };
}
export function voidSale(id: string): Result {
  const s = cur();
  const sale = s.sales.find((v) => v.id === id);
  if (!sale || sale.status !== "confirmada") return { ok: false, error: "Solo se anulan ventas confirmadas" };
  const moves = s.movements.filter((m) => m.refType === "venta" && m.refId === id);
  const r = applyDeltas(s, moves.map((m) => ({ productId: m.productId, qty: -m.qty })), {
    reason: `Anulación de venta ${sale.number}`, refType: "anulacion", refId: id, refCode: sale.number, date: new Date().toISOString(),
  });
  if (typeof r === "string") return { ok: false, error: r };
  commit({ ...r, sales: r.sales.map((v) => (v.id === id ? { ...v, status: "anulada" } : v)) });
  sync("sk_void_sale", { p_id: id });
  return { ok: true };
}
export function deleteSale(id: string): Result {
  const s = cur();
  const v = s.sales.find((x) => x.id === id);
  if (!v || v.status !== "borrador") return { ok: false, error: "Solo se eliminan ventas no confirmadas" };
  commit({ ...s, sales: s.sales.filter((x) => x.id !== id) });
  sync("sk_delete_sale", { p_id: id });
  return { ok: true };
}

// ---------- Formatting ----------
const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
export const fmtCOP = (n: number) => cop.format(Math.round(n));
export function fmtQty(n: number, unit: BaseUnit | Unit) {
  return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(n)} ${unit}`;
}
export const fmtDate = (d: string) => new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
export const fmtDateTime = (d: string) => new Date(d).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

