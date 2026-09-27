import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nid } from "./id";
import type {
  CodeFile,
  LanguageId,
  Locale,
  Mode,
  StudioTab,
  Thread,
} from "./types";

const STARTER = `// SAID
// صف ما تريد بناءه في المحادثة — أو اكتب هنا مباشرة.

export function ready() {
  return true;
}
`;

function seedFile(): CodeFile {
  return {
    id: nid(),
    name: "main.ts",
    language: "typescript",
    content: STARTER,
    updatedAt: Date.now(),
  };
}

function seedThread(): Thread {
  return {
    id: nid(),
    title: "",
    messages: [],
    createdAt: Date.now(),
  };
}

type SaidState = {
  locale: Locale;
  mode: Mode;
  language: LanguageId;
  tab: StudioTab;
  files: CodeFile[];
  activeFileId: string;
  threads: Thread[];
  activeThreadId: string;
  setLocale: (locale: Locale) => void;
  setMode: (mode: Mode) => void;
  setLanguage: (language: LanguageId) => void;
  setTab: (tab: StudioTab) => void;
  setActiveFile: (id: string) => void;
  setActiveThread: (id: string) => void;
  updateFile: (id: string, patch: Partial<Pick<CodeFile, "name" | "content" | "language">>) => void;
  addFile: (name: string, language?: LanguageId, content?: string) => string;
  removeFile: (id: string) => void;
  applyCode: (code: string, filename?: string, language?: LanguageId) => string;
  newThread: () => void;
  appendMessage: (threadId: string, role: "user" | "assistant", content: string) => string;
  patchMessage: (threadId: string, messageId: string, content: string) => void;
};

export const useSaidStore = create<SaidState>()(
  persist(
    (set, get) => {
      const file = seedFile();
      const thread = seedThread();
      return {
        locale: "ar",
        mode: "write",
        language: "typescript",
        tab: "chat",
        files: [file],
        activeFileId: file.id,
        threads: [thread],
        activeThreadId: thread.id,
        setLocale: (locale) => set({ locale }),
        setMode: (mode) => set({ mode }),
        setLanguage: (language) => set({ language }),
        setTab: (tab) => set({ tab }),
        setActiveFile: (id) => set({ activeFileId: id }),
        setActiveThread: (id) => set({ activeThreadId: id }),
        updateFile: (id, patch) =>
          set({
            files: get().files.map((item) =>
              item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item,
            ),
          }),
        addFile: (name, language, content) => {
          const id = nid();
          const fileName = name.trim() || "untitled.ts";
          set({
            files: [
              ...get().files,
              {
                id,
                name: fileName,
                language: language ?? get().language,
                content: content ?? "",
                updatedAt: Date.now(),
              },
            ],
            activeFileId: id,
          });
          return id;
        },
        removeFile: (id) => {
          const remaining = get().files.filter((item) => item.id !== id);
          const next = remaining.length ? remaining : [seedFile()];
          set({
            files: next,
            activeFileId:
              get().activeFileId === id ? next[0]!.id : get().activeFileId,
          });
        },
        applyCode: (code, filename, language) => {
          const files = get().files;
          if (filename) {
            const existing = files.find(
              (item) => item.name.toLowerCase() === filename.toLowerCase(),
            );
            if (existing) {
              get().updateFile(existing.id, {
                content: code,
                language: language ?? existing.language,
              });
              set({ activeFileId: existing.id });
              return existing.id;
            }
            return get().addFile(filename, language, code);
          }
          const active = files.find((item) => item.id === get().activeFileId);
          if (active) {
            get().updateFile(active.id, { content: code });
            return active.id;
          }
          return get().addFile(filename ?? "main.ts", language, code);
        },
        newThread: () => {
          const thread = seedThread();
          set({
            threads: [thread, ...get().threads].slice(0, 24),
            activeThreadId: thread.id,
          });
        },
        appendMessage: (threadId, role, content) => {
          const id = nid();
          set({
            threads: get().threads.map((thread) => {
              if (thread.id !== threadId) return thread;
              const title =
                thread.title ||
                (role === "user" ? content.trim().slice(0, 48) : thread.title);
              return {
                ...thread,
                title,
                messages: [
                  ...thread.messages,
                  { id, role, content, createdAt: Date.now() },
                ],
              };
            }),
          });
          return id;
        },
        patchMessage: (threadId, messageId, content) => {
          set({
            threads: get().threads.map((thread) =>
              thread.id !== threadId
                ? thread
                : {
                    ...thread,
                    messages: thread.messages.map((message) =>
                      message.id === messageId ? { ...message, content } : message,
                    ),
                  },
            ),
          });
        },
      };
    },
    {
      name: "said-studio-v1",
      skipHydration: true,
      partialize: (state) => ({
        locale: state.locale,
        mode: state.mode,
        language: state.language,
        files: state.files,
        activeFileId: state.activeFileId,
        threads: state.threads,
        activeThreadId: state.activeThreadId,
      }),
    },
  ),
);

export function activeFile() {
  const { files, activeFileId } = useSaidStore.getState();
  return files.find((item) => item.id === activeFileId) ?? files[0];
}

export function activeThread() {
  const { threads, activeThreadId } = useSaidStore.getState();
  return threads.find((item) => item.id === activeThreadId) ?? threads[0];
}
