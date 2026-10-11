import { createOpenAI } from "@ai-sdk/openai";

const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";
export const AI_MODEL = "openai/gpt-6-astra";

export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  return {
    getRunId: () => runId,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(RUN_ID_HEADER)) headers.set(RUN_ID_HEADER, runId);
      const response = await fetch(input, { ...init, headers });
      runId ??= response.headers.get(RUN_ID_HEADER)?.trim() || undefined;
      return response;
    },
  };
}

export function createGatewayProvider() {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("La IA no está configurada (falta LOVABLE_API_KEY).");
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  return createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
}
