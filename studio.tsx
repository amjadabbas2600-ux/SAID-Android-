import { Link } from "@tanstack/react-router";
import { Code2, FolderTree, MessageSquare, Plus } from "lucide-react";
import { Toaster } from "sonner";
import { ChatPanel } from "@/components/said/chat-panel";
import { EditorPanel } from "@/components/said/editor-panel";
import { FilesPanel } from "@/components/said/files-panel";
import { LocaleEffect } from "@/components/said/locale-effect";
import { Wordmark } from "@/components/said/mark";
import { SettingsButton } from "@/components/said/settings";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { t } from "@/lib/said/copy";
import { useSaidStore } from "@/lib/said/store";
import { cn } from "@/lib/utils";

export function Studio() {
  const locale = useSaidStore((s) => s.locale);
  const setLocale = useSaidStore((s) => s.setLocale);
  const tab = useSaidStore((s) => s.tab);
  const setTab = useSaidStore((s) => s.setTab);
  const newThread = useSaidStore((s) => s.newThread);
  const mode = useSaidStore((s) => s.mode);
  const c = t(locale);

  return (
    <TooltipProvider>
      <LocaleEffect />
      <div className="flex h-dvh flex-col bg-bg text-fg">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-3 sm:px-4">
          <Link to="/" className="shrink-0">
            <Wordmark size="sm" />
          </Link>
          <span className="hidden text-xs text-subtle sm:inline">{c.modeHint[mode]}</span>
          <div className="ms-auto flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => {
                newThread();
                setTab("chat");
              }}
            >
              <Plus className="size-4" />
              {c.newChat}
            </Button>
            <SettingsButton />
            <button
              type="button"
              onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
              className="inline-flex h-11 min-w-11 items-center justify-center rounded-sm px-3 text-sm text-muted hover:text-fg"
            >
              {c.langToggle}
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="hidden w-56 shrink-0 border-e border-border lg:block">
            <FilesPanel />
          </aside>
          <section
            className={cn(
              "min-h-0 min-w-0 flex-1 border-e border-border",
              tab === "code" ? "flex" : "hidden",
              "md:flex",
            )}
          >
            <EditorPanel />
          </section>
          <section
            className={cn(
              "min-h-0 min-w-0 flex-1",
              tab === "chat" ? "flex" : "hidden md:flex",
              "md:max-w-md lg:max-w-md xl:max-w-lg",
            )}
          >
            <ChatPanel />
          </section>
          <section
            className={cn(
              "min-w-0 flex-1 lg:hidden",
              tab === "files" ? "flex" : "hidden",
            )}
          >
            <FilesPanel />
          </section>
        </div>

        <nav className="flex h-16 shrink-0 items-stretch border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
          {(
            [
              ["chat", c.chat, MessageSquare],
              ["code", c.code, Code2],
              ["files", c.files, FolderTree],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-xs",
                tab === id ? "text-accent" : "text-muted",
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </nav>
      </div>
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          className:
            "!bg-elevated !text-fg !border-0 !shadow-[var(--shadow-border)] !font-sans",
        }}
      />
    </TooltipProvider>
  );
}

export function StudioSkeleton() {
  return (
    <div className="flex h-dvh items-center justify-center bg-bg text-muted">
      <Wordmark />
    </div>
  );
}
