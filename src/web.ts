import { bridge } from "./native";
import type { Note } from "./app";

/** Browser fallback: the same four operations against localStorage, seeded so
 *  the preview opens on real content instead of an empty state. */
const KEY = "hanzo.notes";
const seed: Note[] = [
  {
    id: "welcome",
    title: "Welcome",
    body: `# Welcome

**Notes** is a local-first markdown editor. The native build writes one \`.md\`
file per note into the OS app-data directory — no database, no lock-in, your
notes survive uninstalling the app.

- left pane edits, right pane renders
- autosave after 600ms of quiet
- \`Sync to Base\` pushes every note to a Hanzo Base collection

This browser preview stores the same notes in \`localStorage\`.
`,
    updated: Date.now() - 3600e3,
  },
  {
    id: "why-tauri",
    title: "Why Tauri and not Electron",
    body: `# Why Tauri and not Electron

| | Tauri | Electron |
|---|---|---|
| Installer | ~4 MB | ~120 MB |
| Memory idle | ~40 MB | ~200 MB |
| Webview | the OS one | bundled Chromium |
| Core | Rust | Node |

Electron still wins when you need Chromium-specific APIs (\`desktopCapturer\`)
or a Node-only library in-process. Everything else: Tauri.
`,
    updated: Date.now() - 86400e3,
  },
  {
    id: "shortcuts",
    title: "Shortcuts",
    body: `# Shortcuts

\`⌘N\` new note · \`⌘F\` search · autosave is automatic.

Add more in \`src-tauri/src/lib.rs\` with the global-shortcut plugin.
`,
    updated: Date.now() - 2 * 86400e3,
  },
];

function all(): Note[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    localStorage.setItem(KEY, JSON.stringify(seed));
    return seed;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return seed;
  }
}
const put = (ns: Note[]) => localStorage.setItem(KEY, JSON.stringify(ns));

export const call = bridge({
  notes_dir: () => "localStorage://hanzo.notes",
  list_notes: () => all(),
  save_note: ({ note }: { note: Note }) => {
    const ns = all().filter((n) => n.id !== note.id);
    put([note, ...ns]);
  },
  delete_note: ({ id }: { id: string }) => put(all().filter((n) => n.id !== id)),
});
