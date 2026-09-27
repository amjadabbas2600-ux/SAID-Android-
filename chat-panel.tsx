import { useEffect, useMemo, useRef, useState } from "react";
import { Square, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownView, UserBubble, languageFromBlock } from "@/components/said/markdown-view";
import { t } from "@/lib/said/copy";
import { getGeminiKey } from "@/lib/said/keys";
import { countLines, type CodeBlock } from "@/lib/said/markdown";
import { streamSaid } from "@/lib/said/stream";
import { useSaidStore } from "@/lib/said/store";
import { MODES, type ChatRequest } from "@/lib/said/types";
import { cn } from "@/lib/utils";

export function ChatPanel() {
  const locale = useSaidStore((s) => s.locale);
  const mode = useSaidStore((s) => s.mode);
  const setMode = useSaidStore((s) => s.setMode);
  const language = useSaidStore((s) => s.language);
  const threads = useSaidStore((s) => s.threads);
  const activeThreadId = useSaidStore((s) => s.activeThreadId);
  const files = useSaidStore((s) => s.files);
  const activeFileId = useSaidStore((s) => s.activeFileId);
  const appendMessage = useSaidStore((s) => s.appendMessage);
  const applyCode = useSaidStore((s) => s.applyCode);
  const setTab = useSaidStore((s) => s.setTab);
  const c = t(locale);

  const thread = threads.find((item) => item.id === activeThreadId) ?? threads[0];
  const file = files.find((item) => item.id === activeFileId) ?? files[0];

  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const stats = useMemo(() => {
    const lines = countLines(streaming);
    const minutes = Math.max(elapsed, 0.2) / 60;
    const rate = Math.round(lines / minutes);
    return { lines, rate };
  }, [streaming, elapsed]);

  useEffect(() => {
    const sync = () => setHasKey(Boolean(getGeminiKey()));
    sync();
    window.addEventListener("said-key-change", sync);
    return () => window.removeEventListener("said-key-change", sync);
  }, []);

  useEffect(() => {
    if (!busy || !startedAt) return;
    const id = window.setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 200);
    return () => window.clearInterval(id);
  }, [busy, startedAt]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [thread?.messages.length, streaming]);

  function handleApply(block: CodeBlock) {
    applyCode(block.code, block.filename, languageFromBlock(block));
    setTab("code");
    toast.success(c.applied);
  }

  async function handleCopy(id: string, code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1400);
    } catch {
      toast.error(c.networkError);
    }
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }

  async function send(text?: string) {
    const content = (text ?? draft).trim();
    if (!content || busy || !thread) return;
    setDraft("");
    setError(null);
    appendMessage(thread.id, "user", content);
    setBusy(true);
    setStreaming("");
    setStartedAt(Date.now());
    setElapsed(0);

    const controller = new AbortController();
    abortRef.current = controller;

    const history = [
      ...thread.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content },
    ].slice(-12);

    const request: ChatRequest = {
      locale,
      mode,
      language: file?.language ?? language,
      fileName: file?.name,
      fileContent: file?.content.slice(0, 8000),
      messages: history,
    };

    let assembled = "";
    try {
      assembled = await streamSaid(
        request,
        (chunk) => {
          assembled += chunk;
          setStreaming(assembled);
        },
        controller.signal,
      );
      if (assembled.trim()) {
        appendMessage(thread.id, "assistant", assembled);
      }
    } catch (err) {
      if (controller.signal.aborted) {
        if (assembled.trim()) appendMessage(thread.id, "assistant", assembled);
      } else {
        const message = err instanceof Error ? err.message : "";
        const mapped =
          message === "needkey"
            ? c.needKey
            : message === "badkey"
              ? c.badKey
              : message === "unavailable" || message === "upstream" || message === "rate"
                ? c.aiUnavailable
                : c.networkError;
        setError(mapped);
        toast.error(mapped);
        if (assembled.trim()) appendMessage(thread.id, "assistant", assembled);
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      setStreaming("");
      setStartedAt(null);
    }
  }

  const empty = (thread?.messages.length ?? 0) === 0 && !busy;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-surface">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {empty ? (
          <div className="mx-auto flex max-w-xl flex-col gap-6 pt-8">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-fg">
                {c.emptyChat}
              </h2>
              <p className="mt-2 text-base leading-normal text-muted">{c.emptyChatBody}</p>
              {!hasKey ? (
                <p className="mt-3 text-sm text-accent">{c.needKey}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              {c.suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => void send(item)}
                  className="rounded-md bg-elevated px-4 py-3 text-start text-sm leading-snug text-muted shadow-[var(--shadow-border)] transition-colors duration-150 hover:text-fg"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            {thread?.messages.map((message) =>
              message.role === "user" ? (
                <UserBubble key={message.id} text={message.content} />
              ) : (
                <MarkdownView
                  key={message.id}
                  source={message.content}
                  applyLabel={c.apply}
                  copyLabel={c.copy}
                  copiedLabel={c.copied}
                  copiedId={copiedId}
                  onCopy={handleCopy}
                  onApply={handleApply}
                />
              ),
            )}
            {busy ? (
              <div className="space-y-3">
                <p className="said-shimmer text-sm">{c.thinking}</p>
                {streaming ? (
                  <MarkdownView
                    source={streaming}
                    applyLabel={c.apply}
                    copyLabel={c.copy}
                    copiedLabel={c.copied}
                    copiedId={copiedId}
                    onCopy={handleCopy}
                    onApply={handleApply}
                  />
                ) : null}
                <p className="font-mono text-xs text-subtle tabular-nums">
                  {stats.lines} {c.lines}
                  {" · "}
                  {stats.rate} {c.perMinute}
                </p>
              </div>
            ) : null}
            {error ? (
              <p className="rounded-md bg-elevated px-4 py-3 text-sm text-danger shadow-[var(--shadow-border)]">
                {error}
              </p>
            ) : null}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="border-t border-border bg-surface px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
        <div className="mx-auto max-w-2xl">
          <div className="-mx-1 flex gap-1 overflow-x-auto pb-3">
            {MODES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={cn(
                  "h-9 shrink-0 rounded-full px-3 text-xs transition-colors duration-150",
                  mode === item
                    ? "bg-accent text-accent-fg"
                    : "text-muted hover:text-fg",
                )}
              >
                {c.modes[item]}
              </button>
            ))}
          </div>
          <form
            className="flex items-end gap-2 rounded-lg bg-elevated p-2 shadow-[var(--shadow-border)]"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <Textarea
              ref={inputRef}
              value={draft}
              rows={2}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={c.placeholder}
              className="min-h-14 border-0 bg-transparent px-3 py-2 shadow-none focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            {busy ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="shrink-0"
                onClick={stop}
                aria-label={c.stop}
              >
                <Square className="size-4 fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                className="shrink-0"
                disabled={!draft.trim()}
                aria-label={c.send}
              >
                <ArrowUp className="size-4" />
              </Button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
