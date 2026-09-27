import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Copy, Download, FileCode2, FolderOpen, Play, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/said/copy";
import { languageFromName, LANGUAGES } from "@/lib/said/types";
import { useSaidStore } from "@/lib/said/store";
import { cn } from "@/lib/utils";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlight(code: string, language: string) {
  const safe = escapeHtml(code);
  if (["html", "css"].includes(language)) {
    return safe
      .replace(/(&lt;\/?[\w-]+)/g, '<span class="text-accent">$1</span>')
      .replace(/([.#]?[\w-]+)(\s*\{)/g, '<span class="text-cyan-300">$1</span>$2')
      .replace(/([\w-]+)(\s*:)/g, '<span class="text-amber-300">$1</span>$2');
  }
  return safe
    .replace(/(\/\/.*|#.*)$/gm, '<span class="text-subtle">$1</span>')
    .replace(/\b(const|let|var|function|return|if|else|for|while|class|import|from|export|async|await|def|public|private|static|new|try|catch|throw|extends|interface|type|fn|struct|package|func)\b/g, '<span class="text-accent">$1</span>')
    .replace(/\b(true|false|null|undefined|None|True|False|nil)\b/g, '<span class="text-amber-300">$1</span>')
    .replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '<span class="text-emerald-300">$&</span>');
}

export function CodeReader() {
  const locale = useSaidStore((s) => s.locale);
  const files = useSaidStore((s) => s.files);
  const activeFileId = useSaidStore((s) => s.activeFileId);
  const setActiveFile = useSaidStore((s) => s.setActiveFile);
  const updateFile = useSaidStore((s) => s.updateFile);
  const addFile = useSaidStore((s) => s.addFile);
  const c = t(locale);
  const file = files.find((f) => f.id === activeFileId) ?? files[0];
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(file?.content ?? "");
  const [selectedId, setSelectedId] = useState(file?.id ?? "");

  const current = files.find((f) => f.id === selectedId) ?? file;
  const code = selectedId === file?.id ? draft : current?.content ?? "";
  const language = current?.language ?? "typescript";
  const lines = useMemo(() => Math.max(1, code.split("\n").length), [code]);

  function select(id: string) {
    const next = files.find((f) => f.id === id);
    if (!next) return;
    setSelectedId(id);
    setActiveFile(id);
    setDraft(next.content);
  }

  function save() {
    if (!current) return;
    updateFile(current.id, { content: draft });
    toast.success(locale === "ar" ? "تم حفظ الكود" : "Code saved");
  }

  function importFiles(list: FileList | null) {
    if (!list) return;
    Array.from(list).forEach((raw) => {
      const reader = new FileReader();
      reader.onload = () => {
        const content = String(reader.result ?? "");
        const id = addFile(raw.name, languageFromName(raw.name), content);
        setSelectedId(id);
        setDraft(content);
      };
      reader.readAsText(raw);
    });
  }

  async function copy() {
    await navigator.clipboard.writeText(draft);
    toast.success(c.copied);
  }

  function download() {
    if (!current) return;
    const blob = new Blob([draft], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = current.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!current) return null;

  return (
    <div className="flex h-dvh flex-col bg-[#0b0d10] text-fg">
      <header className="flex min-h-14 items-center gap-2 border-b border-border px-3">
        <Button asChild variant="ghost" size="icon" className="size-10">
          <a href="/studio" aria-label={locale === "ar" ? "العودة" : "Back"}><ArrowLeft className="size-4" /></a>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{locale === "ar" ? "قارئ الأكواد" : "Code Reader"}</div>
          <div className="truncate text-[11px] text-subtle">{current.name}</div>
        </div>
        <Button variant="ghost" size="icon" className="size-10" onClick={() => inputRef.current?.click()} aria-label={locale === "ar" ? "فتح ملف" : "Open file"}><FolderOpen className="size-4" /></Button>
        <Button variant="ghost" size="icon" className="size-10" onClick={copy} aria-label={c.copy}><Copy className="size-4" /></Button>
        <Button variant="ghost" size="icon" className="size-10" onClick={download} aria-label={c.download}><Download className="size-4" /></Button>
        <Button size="sm" onClick={save}><Save className="size-4" />{locale === "ar" ? "حفظ" : "Save"}</Button>
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => importFiles(e.target.files)} />
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 border-e border-border bg-surface md:block">
          <div className="flex items-center justify-between border-b border-border px-3 py-3">
            <span className="text-xs text-muted">{locale === "ar" ? "الملفات" : "Files"}</span>
            <Button variant="ghost" size="icon" className="size-9" onClick={() => inputRef.current?.click()}><FolderOpen className="size-4" /></Button>
          </div>
          <div className="p-2">
            {files.map((item) => (
              <button key={item.id} onClick={() => select(item.id)} className={cn("flex h-10 w-full items-center gap-2 rounded px-2 text-start text-sm", item.id === current.id ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/60 hover:text-fg")}>
                <FileCode2 className="size-4" />
                <span className="truncate font-mono">{item.name}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0 flex-1 flex flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
            <select value={language} onChange={(e) => { const lang = e.target.value as typeof language; updateFile(current.id, { language: lang }); }} className="h-9 rounded bg-elevated px-2 text-xs text-muted">
              {LANGUAGES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <span className="text-xs text-subtle">{lines} {c.lines}</span>
            <span className="ms-auto text-xs text-subtle">{locale === "ar" ? "قراءة وتحرير محلي" : "Local read & edit"}</span>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className="absolute inset-0 overflow-auto p-4 font-mono text-[13px] leading-6" aria-hidden>
              <pre className="min-h-full whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: highlight(code, language) + "\n" }} />
            </div>
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="absolute inset-0 h-full w-full resize-none bg-transparent p-4 font-mono text-[13px] leading-6 text-transparent caret-white outline-none selection:bg-accent/25"
              style={{ WebkitTextFillColor: "transparent" }}
              onScroll={(e) => {
                const layer = e.currentTarget.previousElementSibling as HTMLElement | null;
                if (layer) { layer.scrollTop = e.currentTarget.scrollTop; layer.scrollLeft = e.currentTarget.scrollLeft; }
              }}
              onKeyDown={(e) => {
                if (e.key !== "Tab") return;
                e.preventDefault();
                const el = e.currentTarget; const start = el.selectionStart; const end = el.selectionEnd;
                const next = `${code.slice(0, start)}  ${code.slice(end)}`;
                setDraft(next);
                queueMicrotask(() => { el.selectionStart = el.selectionEnd = start + 2; });
              }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
