import { getGeminiKey } from "./keys";
import type { ChatRequest } from "./types";

export async function streamSaid(
  request: ChatRequest,
  onDelta: (chunk: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const geminiKey = getGeminiKey();
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(geminiKey ? { "x-gemini-key": geminiKey } : {}),
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!res.ok) {
    let message = `error ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* keep status */
    }
    throw new Error(message);
  }

  if (!res.body) {
    throw new Error("empty");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

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
          text?: string;
          error?: string;
          choices?: { delta?: { content?: string } }[];
        };
        if (json.error) throw new Error(json.error);
        const piece = json.text ?? json.choices?.[0]?.delta?.content ?? "";
        if (piece) {
          full += piece;
          onDelta(piece);
        }
      } catch (err) {
        if (err instanceof SyntaxError) continue;
        throw err;
      }
    }
  }

  return full;
}
