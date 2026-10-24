"use client";

import { useState } from "react";
import { normalizeRoom } from "@/lib/route";
import { ROOM_NUMBER, saveRoomNumber } from "@/lib/roomNumbers";

/** The pinned room's number, with Edit to save the real one read off the door. */
export default function RoomNumberEditor({ roomId, number, onSaved }: { roomId: string; number: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(number);
  const [state, setState] = useState<"idle" | "saving" | "saved" | { error: string }>("idle");
  const typed = normalizeRoom(text);

  async function save() {
    setState("saving");
    try {
      await saveRoomNumber(roomId, typed);
      setState("saved");
      setEditing(false);
      onSaved();
    } catch (err) {
      setState({ error: err instanceof Error ? err.message : String(err) });
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-edge px-3 py-2">
        <p className="font-hud text-sm tracking-widest text-glow">
          ROOM {number}
          {state === "saved" && <span className="ml-2 text-[10px] text-muted">SAVED ✓</span>}
        </p>
        <button
          type="button"
          onClick={() => {
            setText(number);
            setState("idle");
            setEditing(true);
          }}
          className="rounded-lg border border-edge px-3 py-1.5 font-hud text-[10px] tracking-widest text-muted"
        >
          ✎ EDIT
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-glow/60 p-3">
      <label htmlFor="room-number" className="text-xs text-muted">
        The number on the door:
      </label>
      <div className="flex gap-2">
        <input
          id="room-number"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoCapitalize="characters"
          className="min-w-0 flex-1 rounded-lg border border-edge bg-void px-3 py-2 font-hud text-sm tracking-widest text-ink outline-none focus:border-glow"
        />
        <button
          type="button"
          onClick={save}
          disabled={!ROOM_NUMBER.test(typed) || state === "saving"}
          className="rounded-lg border border-glow bg-glow/15 px-3 font-hud text-xs tracking-widest text-glow disabled:opacity-40"
        >
          {state === "saving" ? "SAVING…" : "SAVE"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-edge px-3 font-hud text-xs tracking-widest text-muted">
          ✕
        </button>
      </div>
      {typeof state === "object" && <p className="text-xs text-amber">Couldn&apos;t save: {state.error}</p>}
    </div>
  );
}
