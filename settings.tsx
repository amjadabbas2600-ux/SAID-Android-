import { useEffect, useState } from "react";
import { Settings as SettingsIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/said/copy";
import { getGeminiKey, maskKey, setGeminiKey } from "@/lib/said/keys";
import { useSaidStore } from "@/lib/said/store";

export function SettingsButton({ onSaved }: { onSaved?: () => void }) {
  const locale = useSaidStore((s) => s.locale);
  const c = t(locale);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const stored = getGeminiKey();
    setHasKey(Boolean(stored));
    setValue("");
  }, [open]);

  function save() {
    setGeminiKey(value);
    setHasKey(Boolean(value.trim()) || Boolean(getGeminiKey()));
    toast.success(c.saved);
    setOpen(false);
    onSaved?.();
  }

  function remove() {
    setGeminiKey("");
    setHasKey(false);
    setValue("");
    toast.success(c.saved);
    onSaved?.();
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11"
        onClick={() => setOpen((v) => !v)}
        aria-label={c.settings}
      >
        <SettingsIcon className="size-4" />
      </Button>
      {open ? (
        <div className="absolute end-0 top-12 z-40 w-80 rounded-lg bg-elevated p-4 shadow-[var(--shadow-border-hover)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-fg">{c.settings}</h2>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center text-muted hover:text-fg"
              onClick={() => setOpen(false)}
              aria-label={c.cancel}
            >
              <X className="size-4" />
            </button>
          </div>
          <label className="block text-xs text-muted" htmlFor="said-key">
            {c.apiKey}
          </label>
          <p className="mt-1 mb-2 text-xs text-subtle">{c.apiKeyHint}</p>
          {hasKey && !value ? (
            <p className="mb-2 font-mono text-xs text-accent">{maskKey(getGeminiKey())}</p>
          ) : null}
          <input
            id="said-key"
            type="password"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={c.apiKey}
            className="h-11 w-full rounded-sm bg-bg px-3 text-sm text-fg shadow-[var(--shadow-border)] outline-none placeholder:text-subtle"
          />
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" onClick={save} disabled={!value.trim()}>
              {c.save}
            </Button>
            {hasKey ? (
              <Button type="button" size="sm" variant="ghost" onClick={remove}>
                {c.removeKey}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
