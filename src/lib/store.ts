import { useSyncExternalStore } from "react";

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
  price?: number;
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
  refId?: string;
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

// ---------- Store ----------
const KEY = "pizzaflow-state-v1";
let state: State | null = null;
const listeners = new Set<() => void>();
function load(): State {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      state = JSON.parse(raw);
      return state!;
    }
  } catch {}
  state = buildSeed();
  persist();
  return state;
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}
function commit(next: State) {
  state = next;
  persist();
  listeners.forEach((l) => l());
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
  state = buildSeed();
  commit(state);
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
const cur = () => load();

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
  }
  return { ok: true };
}
export function deleteProduct(id: string): Result {
  const s = cur();
  const why = productLinked(s, id);
  if (why) return { ok: false, error: `No se puede eliminar: ${why}. Puedes desactivarlo.` };
  commit({ ...s, products: s.products.filter((p) => p.id !== id) });
  return { ok: true };
}
export function toggleProduct(id: string) {
  const s = cur();
  commit({ ...s, products: s.products.map((p) => (p.id === id ? { ...p, active: !p.active } : p)) });
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
  if (r.id) commit({ ...s, recipes: s.recipes.map((x) => (x.id === r.id ? (r as Recipe) : x)) });
  else commit({ ...s, recipes: [...s.recipes, { ...r, id: uid() }] });
  return { ok: true };
}
export function deleteRecipe(id: string): Result {
  const s = cur();
  if (s.orders.some((o) => o.recipeId === id)) return { ok: false, error: "La receta tiene órdenes de producción asociadas" };
  commit({ ...s, recipes: s.recipes.filter((r) => r.id !== id) });
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
  } else {
    const code = `OP-${String(s.seq.order + 1).padStart(4, "0")}`;
    commit({ ...s, seq: { ...s.seq, order: s.seq.order + 1 }, orders: [{ id: uid(), code, ...o }, ...s.orders] });
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
    return { ok: true };
  }
  if (status === "cancelada") {
    if (o.status === "en_produccion") return { ok: false, error: "Solo se cancelan borradores o pendientes" };
    commit({ ...s, orders: s.orders.map((x) => (x.id === id ? { ...x, status } : x)) });
    return { ok: true };
  }
  return completeOrder(id);
}
export function completeOrder(id: string, at?: string): Result {
  const s = cur();
  const o = s.orders.find((x) => x.id === id);
  if (!o) return { ok: false, error: "Orden no encontrada" };
  if (o.status === "completada") return { ok: false, error: "La orden ya fue completada" };
  if (o.status === "cancelada") return { ok: false, error: "La orden está cancelada" };
  const e = validateOrder(s, o);
  if (e) return { ok: false, error: e };
  const recipe = s.recipes.find((r) => r.id === o.recipeId)!;
  const reqs = requirements(s, o.recipeId, o.qty);
  const date = at ?? new Date().toISOString();
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
  return { ok: true };
}
export function deleteOrder(id: string): Result {
  const s = cur();
  const o = s.orders.find((x) => x.id === id);
  if (!o || o.status !== "borrador") return { ok: false, error: "Solo se eliminan órdenes en borrador" };
  commit({ ...s, orders: s.orders.filter((x) => x.id !== id) });
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
  return { ok: true };
}
export function deleteSale(id: string): Result {
  const s = cur();
  const v = s.sales.find((x) => x.id === id);
  if (!v || v.status !== "borrador") return { ok: false, error: "Solo se eliminan ventas no confirmadas" };
  commit({ ...s, sales: s.sales.filter((x) => x.id !== id) });
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

// ---------- Seed ----------
function buildSeed(): State {
  const P = (id: string, name: string, sku: string, category: Category, unit: BaseUnit, min: number, cost: number, price?: number): Product => ({ id, name, sku, category, unit, stock: 0, min, cost, price, active: true });
  const products = [
    P("harina", "Harina de trigo", "MP-001", "materia", "kg", 5, 4000),
    P("queso", "Queso mozzarella", "MP-002", "materia", "kg", 3, 28000),
    P("tomate", "Salsa de tomate", "MP-003", "materia", "kg", 2, 9000),
    P("pepperoni", "Pepperoni", "MP-004", "materia", "kg", 1, 32000),
    P("champ", "Champiñones", "MP-005", "materia", "kg", 1, 14000),
    P("aceite", "Aceite de oliva", "MP-006", "materia", "l", 0.5, 25000),
    P("masa", "Masa de pizza", "PR-001", "preparacion", "und", 6, 1000),
    P("salsa", "Salsa preparada", "PR-002", "preparacion", "kg", 2, 9500),
    P("margarita", "Pizza Margarita", "PV-001", "venta", "und", 0, 0, 24000),
    P("pizzapep", "Pizza Pepperoni", "PV-002", "venta", "und", 0, 0, 32000),
    P("vegetariana", "Pizza Vegetariana", "PV-003", "venta", "und", 0, 0, 29000),
  ];
  const recipes: Recipe[] = [
    { id: "r-masa", name: "Masa de pizza", productId: "masa", yield: 4, ingredients: [{ productId: "harina", qty: 1, unit: "kg" }, { productId: "aceite", qty: 20, unit: "ml" }] },
    { id: "r-salsa", name: "Salsa preparada", productId: "salsa", yield: 1, ingredients: [{ productId: "tomate", qty: 1, unit: "kg" }, { productId: "aceite", qty: 20, unit: "ml" }] },
    { id: "r-marg", name: "Pizza Margarita", productId: "margarita", yield: 1, ingredients: [{ productId: "masa", qty: 1, unit: "und" }, { productId: "queso", qty: 150, unit: "g" }, { productId: "salsa", qty: 100, unit: "g" }] },
    { id: "r-pep", name: "Pizza Pepperoni", productId: "pizzapep", yield: 1, ingredients: [{ productId: "masa", qty: 1, unit: "und" }, { productId: "queso", qty: 150, unit: "g" }, { productId: "salsa", qty: 100, unit: "g" }, { productId: "pepperoni", qty: 50, unit: "g" }] },
    { id: "r-veg", name: "Pizza Vegetariana", productId: "vegetariana", yield: 1, ingredients: [{ productId: "masa", qty: 1, unit: "und" }, { productId: "queso", qty: 150, unit: "g" }, { productId: "salsa", qty: 100, unit: "g" }, { productId: "champ", qty: 80, unit: "g" }] },
  ];
  const now = Date.now();
  const day = 86400000;
  const at = (daysAgo: number, h: number) => { const d = new Date(now - daysAgo * day); d.setHours(h, 0, 0, 0); return d.toISOString(); };
  let s: State = { products, recipes, orders: [], sales: [], movements: [], seq: { order: 0, sale: 0, adj: 0 } };
  // Initial stock (the opening balance requested), 8 days ago
  const initial: Record<string, number> = { harina: 30, queso: 16, tomate: 10, pepperoni: 4.8, champ: 3.8, aceite: 2.2, masa: 6, salsa: 2 };
  const r0 = applyDeltas(s, Object.entries(initial).map(([productId, qty]) => ({ productId, qty })), { type: "entrada", reason: "Inventario inicial", refType: "ajuste", refCode: "AJ-0001", date: at(8, 8) });
  s = { ...(r0 as State), seq: { order: 0, sale: 0, adj: 1 } };
  state = s;
  const mkOrder = (recipeId: string, qty: number, d: number, status: OrderStatus) => {
    saveOrder({ recipeId, qty, date: at(d, 9), status: "pendiente" });
    const o = state!.orders[0];
    if (status === "completada") completeOrder(o.id, at(d, 10));
    else state = { ...state!, orders: state!.orders.map((x) => (x.id === o.id ? { ...x, status } : x)) };
  };
  const listeners0 = [...listeners];
  listeners.clear();
  mkOrder("r-masa", 20, 7, "completada");
  mkOrder("r-salsa", 4, 7, "completada");
  const plan: [number, [string, number][], PayMethod][] = [
    [6, [["margarita", 2], ["pizzapep", 1]], "Efectivo"],
    [6, [["vegetariana", 1]], "Tarjeta"],
    [5, [["pizzapep", 2]], "Transferencia"],
    [5, [["margarita", 1], ["vegetariana", 1]], "Tarjeta"],
    [4, [["margarita", 3]], "Efectivo"],
    [3, [["pizzapep", 1], ["vegetariana", 1]], "Tarjeta"],
    [3, [["margarita", 1]], "Efectivo"],
    [2, [["pizzapep", 2], ["margarita", 1]], "Transferencia"],
    [1, [["vegetariana", 2]], "Tarjeta"],
    [1, [["margarita", 1], ["pizzapep", 1]], "Efectivo"],
    [0, [["pizzapep", 1], ["margarita", 1]], "Tarjeta"],
  ];
  mkOrder("r-masa", 8, 3, "completada");
  for (const [d, items, method] of plan) {
    saveSale({ date: at(d, 19), method, confirm: true, items: items.map(([pid, qty]) => { const p = state!.products.find((x) => x.id === pid)!; return { productId: pid, name: p.name, qty, price: p.price! }; }) });
  }
  mkOrder("r-salsa", 3, 0, "pendiente");
  mkOrder("r-masa", 12, 0, "borrador");
  saveSale({ date: at(0, 20), method: "Efectivo", confirm: false, items: [{ productId: "vegetariana", name: "Pizza Vegetariana", qty: 1, price: 29000 }] });
  listeners0.forEach((l) => listeners.add(l));
  const out = state!;
  state = null;
  return out;
}
