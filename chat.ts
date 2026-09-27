import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { buildSystemPrompt } from "@/lib/said/prompt";
import type { Mode } from "@/lib/said/types";

const Body = z.object({
  locale: z.enum(["ar", "en"]),
  mode: z.enum([
    "write",
    "debug",
    "refactor",
    "review",
    "explain",
    "architecture",
  ]),
  language: z.string().max(40),
  fileName: z.string().max(80).optional(),
  fileContent: z.string().max(8000).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(12000),
      }),
    )
    .max(16),
});

const MODE_TOKENS: Record<Mode, number> = {
  write: 5500,
  architecture: 4500,
  refactor: 4500,
  debug: 3500,
  review: 3500,
  explain: 2500,
};

const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.0-flash"];

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };
}

function geminiToOpenSse(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  return new ReadableStream({
    async start(controller) {
      const reader = body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const json = JSON.parse(data) as {
                candidates?: {
                  content?: { parts?: { text?: string }[] };
                }[];
              };
              const text =
                json.candidates?.[0]?.content?.parts
                  ?.map((part) => part.text ?? "")
                  .join("") ?? "";
              if (text) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text })}\n\n`),
                );
              }
            } catch {
              /* skip malformed */
            }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

async function streamGemini(
  apiKey: string,
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens: number,
  signal: AbortSignal,
): Promise<Response | null> {
  const contents = messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
  const payload = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens },
  };

  for (const model of GEMINI_MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(payload),
        signal,
      },
    );
    if (res.ok && res.body) {
      return new Response(geminiToOpenSse(res.body), { headers: sseHeaders() });
    }
    if (res.status === 401 || res.status === 403) {
      return Response.json({ error: "badkey" }, { status: 401 });
    }
    if (res.status !== 404) {
      return Response.json({ error: "upstream" }, { status: 502 });
    }
  }
  return null;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ error: "invalid" }, { status: 400 });
        }

        const parsed = Body.safeParse(json);
        if (!parsed.success) {
          return Response.json({ error: "invalid" }, { status: 400 });
        }

        const data = parsed.data;
        const messages = data.messages.slice(-12);
        if (messages.length === 0) {
          return Response.json({ error: "empty" }, { status: 400 });
        }

        const system = buildSystemPrompt(data);
        const maxTokens = MODE_TOKENS[data.mode];
        const geminiKey = request.headers.get("x-gemini-key")?.trim() ?? "";

        if (geminiKey && geminiKey.length >= 12 && geminiKey.length <= 200) {
          const gemini = await streamGemini(
            geminiKey,
            system,
            messages,
            maxTokens,
            request.signal,
          );
          if (gemini) return gemini;
        }

        const apiKey = process.env.XAI_API_KEY;
        if (!apiKey) {
          return Response.json(
            { error: geminiKey ? "upstream" : "needkey" },
            { status: 503 },
          );
        }

        const payload = {
          model: "grok-4.5",
          stream: true,
          temperature: 0.2,
          max_tokens: maxTokens,
          messages: [{ role: "system", content: system }, ...messages],
        };

        const run = () =>
          fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
            signal: request.signal,
          });

        let upstream = await run();
        if (upstream.status >= 500) upstream = await run();

        if (!upstream.ok) {
          if (upstream.status === 401 || upstream.status === 403) {
            return Response.json(
              { error: geminiKey ? "upstream" : "needkey" },
              { status: 503 },
            );
          }
          const status = upstream.status === 429 ? 429 : 502;
          return Response.json(
            { error: status === 429 ? "rate" : "upstream" },
            { status },
          );
        }

        if (!upstream.body) {
          return Response.json({ error: "empty" }, { status: 502 });
        }

        return new Response(upstream.body, { headers: sseHeaders() });
      },
    },
  },
});
