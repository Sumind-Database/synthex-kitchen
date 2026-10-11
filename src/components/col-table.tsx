import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Column definition for per-column filter + sort tables.
 * - text: free search input; select: dropdown of distinct values (for repetitive columns);
 * - number/date: sortable, filter by range (min/max or from/to).
 */
export type Col<T> = {
  label: string;
  type?: "text" | "select" | "number" | "date" | "none";
  /** Value used for filtering/sorting. For select, the displayed option text. */
  value?: (r: T) => string | number;
  sortable?: boolean;
};

type F = { text?: string; min?: string; max?: string };

const inCls = "h-7 w-full min-w-0 rounded border border-input bg-card px-2 text-[11px] font-normal normal-case tracking-normal text-foreground outline-none focus:ring-2 focus:ring-ring/40";

export function useColumnTable<T>(rows: T[], cols: Col<T>[], initialSort?: { i: number; dir: "asc" | "desc" }) {
  const [filters, setFilters] = useState<Record<number, F>>({});
  const [sort, setSort] = useState<{ i: number; dir: "asc" | "desc" } | null>(initialSort ?? null);

  const options = useMemo(() => cols.map((c) => (c.type === "select" && c.value ? Array.from(new Set(rows.map((r) => String(c.value!(r))))).filter(Boolean).sort((a, b) => a.localeCompare(b, "es")) : [])), [rows, cols]);

  const out = useMemo(() => {
    let r = rows.filter((row) => cols.every((c, i) => {
      const f = filters[i]; if (!f || !c.value) return true;
      const v = c.value(row);
      if (c.type === "text") return !f.text || String(v).toLowerCase().includes(f.text.toLowerCase());
      if (c.type === "select") return !f.text || String(v) === f.text;
      if (c.type === "number") return (!f.min || Number(v) >= Number(f.min)) && (!f.max || Number(v) <= Number(f.max));
      if (c.type === "date") { const d = String(v).slice(0, 10); return (!f.min || d >= f.min) && (!f.max || d <= f.max); }
      return true;
    }));
    if (sort) {
      const get = cols[sort.i]?.value;
      if (get) r = [...r].sort((a, b) => {
        const x = get(a), y = get(b);
        const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "es", { numeric: true });
        return sort.dir === "asc" ? c : -c;
      });
    }
    return r;
  }, [rows, cols, filters, sort]);

  const set = (i: number, p: F) => setFilters((f) => ({ ...f, [i]: { ...f[i], ...p } }));
  const active = Object.values(filters).some((f) => f.text || f.min || f.max);

  const head: ReactNode[] = cols.map((c, i) => {
    const canSort = c.value && c.sortable !== false && c.type !== "none";
    const dir = sort?.i === i ? sort.dir : null;
    const f = filters[i] ?? {};
    return (
      <div key={i} className="flex min-w-24 flex-col gap-1.5 py-0.5">
        {canSort ? (
          <button type="button" className={cn("flex items-center gap-1 text-left uppercase hover:text-foreground", dir && "text-foreground")}
            onClick={() => setSort(dir === "asc" ? { i, dir: "desc" } : dir === "desc" ? null : { i, dir: "asc" })}>
            {c.label}{dir === "asc" ? <ArrowUp className="h-3 w-3" /> : dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
          </button>
        ) : <span>{c.label}</span>}
        {c.type === "text" && <input className={inCls} placeholder="Buscar…" value={f.text ?? ""} onChange={(e) => set(i, { text: e.target.value })} />}
        {c.type === "select" && (
          <select className={inCls} value={f.text ?? ""} onChange={(e) => set(i, { text: e.target.value })}>
            <option value="">Todos</option>{options[i]!.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        {c.type === "number" && (
          <div className="flex gap-1"><input type="number" className={inCls} placeholder="Mín" value={f.min ?? ""} onChange={(e) => set(i, { min: e.target.value })} /><input type="number" className={inCls} placeholder="Máx" value={f.max ?? ""} onChange={(e) => set(i, { max: e.target.value })} /></div>
        )}
        {c.type === "date" && (
          <div className="flex flex-col gap-1"><input type="date" className={inCls} title="Desde" value={f.min ?? ""} onChange={(e) => set(i, { min: e.target.value })} /><input type="date" className={inCls} title="Hasta" value={f.max ?? ""} onChange={(e) => set(i, { max: e.target.value })} /></div>
        )}
        {(!c.type || c.type === "none") && i === cols.length - 1 && active && (
          <button type="button" className="text-right text-[11px] font-semibold normal-case text-chart-2 hover:underline" onClick={() => setFilters({})}>Limpiar</button>
        )}
      </div>
    );
  });

  return { rows: out, head };
}
