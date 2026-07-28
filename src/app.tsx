import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import { Win, NavItem } from "./shell";
import { isNative } from "./native";
import { call } from "./web";
import { push } from "./base";

const RELEASES = "https://github.com/hanzo-templates/desktop-notes/releases/latest";

export type Note = { id: string; title: string; body: string; updated: number };

const fmt = (t: number) =>
  new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [id, setId] = useState<string>("");
  const [q, setQ] = useState("");
  const [dirty, setDirty] = useState(false);
  const [where, setWhere] = useState("…");
  const [sync, setSync] = useState("");

  useEffect(() => {
    (async () => {
      const [ns, root] = await Promise.all([call("list_notes"), call("notes_dir")]);
      setNotes(ns);
      setWhere(root);
      setId(ns[0]?.id ?? "");
    })();
  }, []);

  const note = notes.find((n) => n.id === id);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const hit = s
      ? notes.filter((n) => (n.title + " " + n.body).toLowerCase().includes(s))
      : notes;
    return [...hit].sort((a, b) => b.updated - a.updated);
  }, [notes, q]);

  const html = useMemo(
    () => (note ? (marked.parse(note.body, { async: false }) as string) : ""),
    [note?.body, note?.id],
  );

  function edit(body: string) {
    if (!note) return;
    const title = body.split("\n")[0].replace(/^#+\s*/, "").slice(0, 60) || "Untitled";
    setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, body, title, updated: Date.now() } : n)));
    setDirty(true);
  }

  async function save() {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    await call("save_note", { note: n });
    setDirty(false);
  }

  async function create() {
    const n: Note = { id: crypto.randomUUID(), title: "Untitled", body: "# Untitled\n\n", updated: Date.now() };
    await call("save_note", { note: n });
    setNotes((ns) => [n, ...ns]);
    setId(n.id);
  }

  async function remove(nid: string) {
    await call("delete_note", { id: nid });
    setNotes((ns) => ns.filter((n) => n.id !== nid));
    if (nid === id) setId("");
  }

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(save, 600); // autosave, the only write path
    return () => clearTimeout(t);
  }, [dirty, notes, id]);

  return (
    <Win
      title="Notes"
      sub={dirty ? "saving…" : "saved"}
      releases={RELEASES}
      wide
      flush
      status={
        <>
          <span className="mono">{where}</span>
          <span className="grow" />
          {sync && <span>{sync}</span>}
          <span>{notes.length} notes</span>
        </>
      }
      actions={
        <button
          className="btn"
          onClick={async () => {
            const r = await push("notes", notes.map(({ title, body, updated }) => ({ title, body, updated })));
            setSync(r.note);
          }}
        >
          sync to Base
        </button>
      }
      side={
        <>
          <input className="inp" placeholder="search" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="row" style={{ margin: "10px 0 6px" }}>
            <button className="btn pri" style={{ width: "100%" }} onClick={create}>
              new note
            </button>
          </div>
          <nav className="nav">
            {shown.map((n) => (
              <NavItem key={n.id} on={n.id === id} onClick={() => setId(n.id)}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {n.title}
                </span>
              </NavItem>
            ))}
            {shown.length === 0 && <div className="empty">nothing matches</div>}
          </nav>
        </>
      }
    >
      {!note ? (
        <div className="empty">pick a note, or create one</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", height: "100%" }}>
          <textarea
            className="mono"
            value={note.body}
            onChange={(e) => edit(e.target.value)}
            spellCheck={false}
            style={{
              background: "var(--bg)", color: "var(--fg)", border: 0, outline: 0,
              padding: "18px 20px", resize: "none", lineHeight: 1.65, fontSize: 13,
            }}
          />
          <div
            className="md"
            style={{ borderLeft: "1px solid var(--line)", padding: "18px 20px", overflow: "auto" }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
      <div className="dim mono" style={{ position: "fixed", right: 14, bottom: 34, fontSize: 11 }}>
        {note ? fmt(note.updated) : ""} · {isNative ? "app data dir" : "localStorage"}
      </div>
    </Win>
  );
}
