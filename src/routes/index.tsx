import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Pizza, Package, Factory, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Synthex Kitchen — Ingresar" },
      { name: "description", content: "Synthex Kitchen: inventario, recetas, producción y ventas para pizzerías." },
      { property: "og:title", content: "Synthex Kitchen — Gestión para pizzerías" },
      { property: "og:description", content: "Inventario, recetas, producción y ventas en un solo lugar." },
    ],
  }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><Pizza className="h-6 w-6" /></div>
          <span className="text-xl font-bold text-sidebar-accent-foreground">Synthex Kitchen</span>
        </div>
        <div>
          <h2 className="max-w-md text-4xl font-bold leading-tight text-sidebar-accent-foreground">Del costal de harina al plato vendido, todo bajo control.</h2>
          <div className="mt-8 space-y-3 text-sm">
            {[[Package, "Inventario con alertas de reposición"], [Factory, "Órdenes de producción por receta"], [ShoppingCart, "Ventas que descuentan insumos automáticamente"]].map(([I, t]: any) => (
              <div key={t} className="flex items-center gap-3"><I className="h-4 w-4 text-sidebar-primary" />{t}</div>
            ))}
          </div>
        </div>
        <div className="text-xs opacity-60">© 2026 Synthex Kitchen · Forno Pizza</div>
      </div>
      <div className="flex items-center justify-center bg-background p-6">
        <form className="w-full max-w-sm space-y-5 rounded-xl border bg-card p-8" onSubmit={(e) => { e.preventDefault(); nav({ to: "/app" }); }}>
          <div>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground lg:hidden"><Pizza className="h-6 w-6" /></div>
            <h1 className="text-2xl font-bold">Bienvenido a Synthex Kitchen</h1>
            <p className="text-sm text-muted-foreground">Ingresa para gestionar Forno Pizza.</p>
          </div>
          <div className="space-y-1.5"><label className="text-xs font-semibold">Correo</label><Input type="email" defaultValue="laura@fornopizza.co" /></div>
          <div className="space-y-1.5"><label className="text-xs font-semibold">Contraseña</label><Input type="password" defaultValue="demo1234" /></div>
          <Button type="submit" className="w-full">Ingresar</Button>
          <p className="text-center text-[11px] text-muted-foreground">Prototipo demo: no se validan credenciales.</p>
        </form>
      </div>
    </div>
  );
}
