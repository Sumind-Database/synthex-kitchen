import { Tag } from "./kit";
import { stockStatus, type OrderStatus, type Product, type SaleStatus, type MoveType } from "@/lib/store";

export function StockBadge({ p }: { p: Product }) {
  if (!p.active) return <Tag tone="gray">Inactivo</Tag>;
  const s = stockStatus(p);
  if (s === "na") return <Tag tone="blue">Bajo pedido</Tag>;
  if (s === "agotado") return <Tag tone="red">Agotado</Tag>;
  if (s === "bajo") return <Tag tone="amber">Stock bajo</Tag>;
  return <Tag tone="green">Óptimo</Tag>;
}
export const ORDER_LABEL: Record<OrderStatus, string> = {
  borrador: "Borrador", pendiente: "Pendiente", en_produccion: "En producción", completada: "Completada", cancelada: "Cancelada",
};
export function OrderBadge({ s }: { s: OrderStatus }) {
  const tone = { borrador: "gray", pendiente: "amber", en_produccion: "blue", completada: "green", cancelada: "red" } as const;
  return <Tag tone={tone[s]}>{ORDER_LABEL[s]}</Tag>;
}
export function SaleBadge({ s }: { s: SaleStatus }) {
  return s === "confirmada" ? <Tag tone="green">Confirmada</Tag> : s === "anulada" ? <Tag tone="red">Anulada</Tag> : <Tag tone="gray">Borrador</Tag>;
}
export function MoveBadge({ t }: { t: MoveType }) {
  return t === "entrada" ? <Tag tone="green">Entrada</Tag> : t === "salida" ? <Tag tone="red">Salida</Tag> : <Tag tone="amber">Ajuste</Tag>;
}
