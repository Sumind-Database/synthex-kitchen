import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Result } from "@/lib/store";

export function notify(r: Result, success: string) {
  if (r.ok) toast.success(success);
  else toast.error(r.error);
  return r.ok;
}

export function PageHeader({ title, description, crumb, actions }: { title: string; description: string; crumb?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <nav className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Link to="/app" className="hover:text-foreground">Forno Pizza</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{crumb ?? title}</span>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

const TONES = {
  green: "bg-accent text-secondary-foreground border-primary/30",
  amber: "bg-warning/10 text-warning border-warning/30",
  red: "bg-destructive/10 text-destructive border-destructive/30",
  gray: "bg-muted text-muted-foreground border-border",
  dark: "bg-secondary-foreground text-primary-foreground border-transparent",
  blue: "bg-chart-4/30 text-chart-3 border-chart-4",
};
export function Tag({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold", TONES[tone])}>{children}</span>;
}

export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      {title && (
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function DataTable({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {head.map((h, i) => <th key={i} className="whitespace-nowrap px-4 py-2.5 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr:last-child]:border-0 [&>tr:hover]:bg-muted/40 [&_td]:px-4 [&_td]:py-2.5">{children}</tbody>
      </table>
      {empty && <Empty text="No hay registros que coincidan con los filtros." />}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
      <Inbox className="h-8 w-8 opacity-50" />
      {text}
    </div>
  );
}

export function SidePanel({ open, onClose, title, description, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className={cn("flex w-full flex-col gap-0 p-0", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}>
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t bg-muted/40 px-6 py-3">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}

export function FormFooter({ onCancel, onSave, saveLabel = "Guardar", extra }: { onCancel: () => void; onSave: () => void; saveLabel?: string; extra?: ReactNode }) {
  return (
    <>
      <Button variant="outline" onClick={onCancel}>Cancelar</Button>
      {extra}
      <Button onClick={onSave}>{saveLabel}</Button>
    </>
  );
}

export function Confirm({ open, onClose, title, description, onConfirm, label = "Confirmar", danger }: {
  open: boolean; onClose: () => void; title: string; description: string; onConfirm: () => void; label?: string; danger?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction className={danger ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""} onClick={() => { onConfirm(); onClose(); }}>{label}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const selectCls = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40";

export function Select({ value, onChange, children, className }: { value: string; onChange: (v: string) => void; children: ReactNode; className?: string }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(selectCls, className)}>{children}</select>;
}

export function Kpi({ label, value, hint, icon, tone }: { label: string; value: string; hint?: string | undefined; icon: ReactNode; tone?: "red" | "amber" | undefined }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("rounded-md p-1.5", tone === "red" ? "bg-destructive/10 text-destructive" : tone === "amber" ? "bg-warning/10 text-warning" : "bg-accent text-chart-2")}>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
