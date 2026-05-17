import { useEffect, useState } from "react";
import {
  MeshNameInput,
  MeshToasts,
  pushToast,
  useEventLog,
  useNamedPeer,
  usePhase,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Msg = {
  id: string;
  peerId: string;
  text: string;
  ts: number;
  valid: boolean;
};

const isQuestion = (s: string) => {
  const t = s.trim();
  return t.endsWith("?") || t.endsWith("？");
};

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="qonly-screen">
        <h1>questions only</h1>
        <p className="qonly-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const { name, setName, nameOf } = useNamedPeer(config, room);
  const log = useEventLog<Msg>(room, "chain");
  const phase = usePhase<"playing" | "broken">(room, "phase", "playing");
  const [draft, setDraft] = useState("");

  const breakerMap = room.doc.getMap<string>("breaker");
  const [, force] = useState(0);
  useEffect(() => {
    const cb = () => force((n) => n + 1);
    breakerMap.observe(cb);
    return () => breakerMap.unobserve(cb);
  }, [breakerMap]);

  const trimmed = name.trim();
  const broken = phase.phase === "broken";
  const validCount = log.events.filter((m) => m.valid).length;
  const breakerId = breakerMap.get("peerId");
  const breakerName = breakerId ? nameOf(breakerId) : "someone";

  const send = () => {
    const text = draft.trim();
    if (!text || broken || !trimmed) return;
    const valid = isQuestion(text);
    const msg: Msg = {
      id: Math.random().toString(36).slice(2, 12),
      peerId: room.peerId,
      text,
      ts: Date.now(),
      valid,
    };
    log.push(msg);
    setDraft("");
    if (!valid) {
      room.doc.transact(() => {
        breakerMap.set("peerId", room.peerId);
      });
      phase.transition("broken", { from: "playing" });
      pushToast(room, "💔 chain broken", { ttl: 3500, peerId: room.peerId });
    }
  };

  const restart = () => {
    log.clear();
    room.doc.transact(() => {
      breakerMap.delete("peerId");
    });
    phase.transition("playing", { from: "broken" });
  };

  return (
    <div className="qonly-screen">
      <MeshToasts room={room} resolveName={nameOf} position="top" />
      <header className="qonly-header">
        <h1>questions only</h1>
        <p className="qonly-status">
          <span className="qonly-chip" data-phase={phase.phase}>
            {broken ? "broken" : "playing"}
          </span>{" "}
          {validCount} valid · {log.size} total
        </p>
      </header>
      <MeshNameInput
        className="qonly-name"
        value={name}
        onChange={setName}
        placeholder="your name"
        maxLength={48}
      />
      <div className="qonly-chat" role="log">
        {log.events.map((m) => (
          <div key={m.id} className="qonly-msg" data-msg-id={m.id}>
            <span className="qonly-author">{nameOf(m.peerId)}</span>
            <span className="qonly-text">{m.text}</span>
            <span className="qonly-mark" data-valid={m.valid}>
              {m.valid ? "✓" : "✗"}
            </span>
          </div>
        ))}
      </div>
      <form
        className="qonly-form"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          className="qonly-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="ask a question…"
          disabled={broken || !trimmed}
          maxLength={280}
        />
        <button
          type="submit"
          className="qonly-send"
          aria-label="send"
          disabled={broken || !trimmed || !draft.trim()}
        >
          send
        </button>
      </form>
      {broken && (
        <>
          <div className="qonly-broken-banner">broken by {breakerName} 💔</div>
          <button type="button" className="qonly-restart" aria-label="restart" onClick={restart}>
            restart
          </button>
        </>
      )}
    </div>
  );
}
