import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ContextSchema = z.object({
  fecha: z.string(),
  preparaciones: z.array(z.object({
    productId: z.string(),
    nombre: z.string(),
    unidad: z.string(),
    stock: z.number(),
    minimo: z.number(),
    consumoDiarioPromedio7d: z.number(),
    receta: z.object({
      rendimiento: z.number(),
      ingredientes: z.array(z.object({ nombre: z.string(), cantidad: z.number(), unidad: z.string(), stockDisponible: z.number(), unidadStock: z.string() })),
    }).nullable(),
    ordenesAbiertas: z.array(z.object({ codigo: z.string(), cantidad: z.number(), estado: z.string() })),
  })),
});
export type AiContext = z.infer<typeof ContextSchema>;

export type AiSuggestion = { productId: string; qty: number; prioridad: "alta" | "media" | "baja"; razon: string };
export type AiResult = { ok: true; resumen: string; sugerencias: AiSuggestion[] } | { ok: false; error: string };

const OutSchema = z.object({
  resumen: z.string(),
  sugerencias: z.array(z.object({
    productId: z.string(),
    qty: z.number(),
    prioridad: z.enum(["alta", "media", "baja"]),
    razon: z.string(),
  })),
});

const INSTRUCTIONS = `Eres el asistente de producción de la pizzería Forno Pizza. Decide qué preparaciones (masa, salsas, etc.) producir HOY.
Reglas:
- Objetivo: cubrir el consumo esperado de hoy y mañana (consumoDiarioPromedio7d) y mantener al menos el stock mínimo, sin producir de más para evitar desperdicio.
- Resta las cantidades de órdenes abiertas (borrador, pendiente, en producción): no sugieras duplicados.
- Considera el stock de materias primas de la receta; si limita, ajusta la cantidad a lo posible o explícalo.
- qty en la unidad del producto, redondeada de forma práctica (idealmente múltiplos del rendimiento de la receta).
- Usa exactamente los productId recibidos. Omite productos que no necesitan producción.
- razon: 1 o 2 frases en español. resumen: máximo 3 frases en español.`;

export const suggestProduction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ContextSchema.parse(d))
  .handler(async ({ data }): Promise<AiResult> => {
    try {
      const { streamText, Output } = await import("ai");
      const { createGatewayProvider, AI_MODEL } = await import("./ai-gateway.server");
      const provider = createGatewayProvider();
      const result = streamText({
        model: provider.responses(AI_MODEL),
        instructions: INSTRUCTIONS,
        messages: [{ role: "user", content: `Datos actuales:\n${JSON.stringify(data)}` }],
        output: Output.object({ schema: OutSchema }),
        providerOptions: {
          openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
        },
      });
      const out = await result.output;
      const valid = new Set(data.preparaciones.map((p) => p.productId));
      const sugerencias = out.sugerencias.filter((s) => valid.has(s.productId) && s.qty > 0).map((s) => ({ ...s, qty: Math.round(s.qty * 1000) / 1000 }));
      return { ok: true, resumen: out.resumen.slice(0, 600), sugerencias };
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      const code = err.statusCode;
      console.error("suggestProduction error", e);
      if (code === 429) return { ok: false, error: "Demasiadas solicitudes a la IA. Intenta de nuevo en un momento." };
      if (code === 402) return { ok: false, error: "Se agotaron los créditos de IA del espacio de trabajo." };
      if (code === 403) return { ok: false, error: "El acceso a la IA no está disponible para este espacio de trabajo." };
      return { ok: false, error: "No se pudieron generar sugerencias. " + (err.message ?? "") };
    }
  });
