import { z } from "zod";
import { serverEnv } from "@/server/env";

/**
 * Minimal fetch wrapper around OpenAI's Responses API. We avoid the
 * `openai` SDK to keep the bundle small and the surface area visible.
 */

export class OpenAIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export class OpenAIInvalidKeyError extends OpenAIError {
  constructor(message: string) {
    super(message, 401);
  }
}
export class OpenAIQuotaError extends OpenAIError {
  constructor(message: string) {
    super(message, 429);
  }
}

const ResponseSchema = z.object({
  id: z.string(),
  output: z.array(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("reasoning"),
        summary: z.array(z.unknown()).optional()
      }),
      z.object({
        type: z.literal("message"),
        content: z.array(
          z.object({
            type: z.string(),
            text: z.string().optional()
          })
        )
      })
    ])
  ),
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      output_tokens_details: z
        .object({
          reasoning_tokens: z.number().optional()
        })
        .optional()
    })
    .optional()
});

export type ReasoningInput = {
  apiKey: string;
  model?: string;
  system: string;
  user: string;
  effort?: "low" | "medium" | "high";
  maxOutputTokens?: number;
};

export type ReasoningResult = {
  output: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
  };
  model: string;
};

export function defaultModel(): string {
  return serverEnv.OPENAI_MODEL ?? "o3";
}

export async function runReasoning(input: ReasoningInput): Promise<ReasoningResult> {
  const model = input.model ?? defaultModel();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: input.system },
        { role: "user", content: input.user }
      ],
      reasoning: { effort: input.effort ?? "high" },
      max_output_tokens: input.maxOutputTokens ?? 16000
    })
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401) {
      throw new OpenAIInvalidKeyError(`OpenAI rejected the API key: ${body}`);
    }
    if (response.status === 429) {
      throw new OpenAIQuotaError(`OpenAI rate-limited the request: ${body}`);
    }
    throw new OpenAIError(`OpenAI request failed (${response.status}): ${body}`, response.status);
  }

  const raw: unknown = await response.json();
  const parsed = ResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new OpenAIError(`OpenAI returned an unexpected shape: ${parsed.error.message}`, 502);
  }

  let output = "";
  for (const item of parsed.data.output) {
    if (item.type === "message") {
      for (const chunk of item.content) {
        if (chunk.text) output += chunk.text;
      }
    }
  }

  return {
    output,
    usage: {
      inputTokens: parsed.data.usage?.input_tokens ?? 0,
      outputTokens: parsed.data.usage?.output_tokens ?? 0,
      reasoningTokens: parsed.data.usage?.output_tokens_details?.reasoning_tokens ?? 0
    },
    model
  };
}

export type StreamingEvent =
  | { kind: "delta"; text: string }
  | { kind: "reasoning"; text: string }
  | { kind: "done"; usage: ReasoningResult["usage"]; model: string }
  | { kind: "error"; message: string };

/**
 * Streams the Responses API as SSE so the UI can show tokens as they arrive.
 * Yields one StreamingEvent per OpenAI event of interest.
 */
export async function* streamReasoning(input: ReasoningInput): AsyncGenerator<StreamingEvent, void, void> {
  const model = input.model ?? defaultModel();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
      Accept: "text/event-stream"
    },
    body: JSON.stringify({
      model,
      stream: true,
      input: [
        { role: "system", content: input.system },
        { role: "user", content: input.user }
      ],
      reasoning: { effort: input.effort ?? "high" },
      max_output_tokens: input.maxOutputTokens ?? 16000
    })
  });

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    if (response.status === 401) throw new OpenAIInvalidKeyError(body || "invalid key");
    if (response.status === 429) throw new OpenAIQuotaError(body || "rate limited");
    throw new OpenAIError(`OpenAI streaming failed (${response.status}): ${body}`, response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let usage: ReasoningResult["usage"] = { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx = buffer.indexOf("\n\n");
    while (idx !== -1) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
      if (dataLine) {
        const data = dataLine.slice(5).trim();
        if (data && data !== "[DONE]") {
          try {
            const payload = JSON.parse(data) as Record<string, unknown>;
            const event = await interpret(payload);
            if (event.kind === "done") {
              usage = event.usage;
              yield event;
            } else if (event.kind !== "ignore") {
              yield event;
            }
          } catch {
            // Tolerate non-JSON keepalives.
          }
        }
      }
      idx = buffer.indexOf("\n\n");
    }
  }

  // Some streams don't emit a final "completed" event we can identify; ensure
  // the consumer sees a done with the usage we collected.
  yield { kind: "done", usage, model };
}

type InternalEvent =
  | { kind: "delta"; text: string }
  | { kind: "reasoning"; text: string }
  | { kind: "done"; usage: ReasoningResult["usage"]; model: string }
  | { kind: "error"; message: string }
  | { kind: "ignore" };

async function interpret(payload: Record<string, unknown>): Promise<InternalEvent> {
  const type = typeof payload.type === "string" ? payload.type : "";

  if (type === "response.output_text.delta") {
    const delta = typeof payload.delta === "string" ? payload.delta : "";
    return { kind: "delta", text: delta };
  }
  if (type === "response.reasoning_summary_text.delta") {
    const delta = typeof payload.delta === "string" ? payload.delta : "";
    return { kind: "reasoning", text: delta };
  }
  if (type === "response.error" || type === "error") {
    const err = (payload.error ?? payload) as { message?: string };
    return { kind: "error", message: err.message ?? "unknown openai error" };
  }
  if (type === "response.completed") {
    const completed = payload.response as Record<string, unknown> | undefined;
    const usage = completed?.usage as Record<string, unknown> | undefined;
    const tokensIn = typeof usage?.input_tokens === "number" ? usage.input_tokens : 0;
    const tokensOut = typeof usage?.output_tokens === "number" ? usage.output_tokens : 0;
    const tokensDetails = usage?.output_tokens_details as Record<string, unknown> | undefined;
    const reasoningTokens =
      typeof tokensDetails?.reasoning_tokens === "number" ? tokensDetails.reasoning_tokens : 0;
    return {
      kind: "done",
      usage: { inputTokens: tokensIn, outputTokens: tokensOut, reasoningTokens },
      model: typeof completed?.model === "string" ? completed.model : defaultModel()
    };
  }
  return { kind: "ignore" };
}
