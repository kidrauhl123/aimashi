import type { WsEnvelope } from "./types";

export function eventsUrlFor(apiBase: string, sinceSeq: number): string {
  const base = (apiBase || "")
    .replace(/\/+$/, "")
    .replace(/^http:/, "ws:")
    .replace(/^https:/, "wss:");
  return `${base}/api/events?since_seq=${Number(sinceSeq) || 0}`;
}

export function backoffMs(attempt: number): number {
  return Math.min(30000, 1000 * Math.pow(2, Math.max(0, attempt)));
}

interface Deps {
  apiBase: string;
  getToken: () => string;
  WebSocketImpl?: any;
  scheduleReconnect?: (fn: () => void, ms: number) => void;
}

interface ConnectOpts {
  sinceSeq: () => number;
  onEvent: (e: WsEnvelope) => void;
  onStatus?: (s: string) => void;
}

export function createEventsClient(deps: Deps) {
  const WS = deps.WebSocketImpl || (globalThis as any).WebSocket;
  const schedule = deps.scheduleReconnect || ((fn: () => void, ms: number) => setTimeout(fn, ms));
  let socket: any = null;
  let stopped = false;
  let attempt = 0;

  function connect(opts: ConnectOpts) {
    stopped = false;
    const token = deps.getToken();
    if (!token || !WS) return;
    disconnect();
    let s: any;
    try {
      s = new WS(eventsUrlFor(deps.apiBase, opts.sinceSeq()), ["mia-token." + token]);
    } catch {
      if (!stopped) schedule(() => connect(opts), backoffMs(attempt++));
      return;
    }
    socket = s;
    opts.onStatus?.("connecting");
    s.addEventListener("open", () => {
      attempt = 0;
      opts.onStatus?.("open");
    });
    s.addEventListener("message", (ev: any) => {
      if (socket !== s) return;
      let env: WsEnvelope;
      try {
        env = JSON.parse(ev.data);
      } catch {
        return;
      }
      opts.onEvent(env);
    });
    const down = () => {
      if (socket !== s) return;
      socket = null;
      opts.onStatus?.("down");
      if (!stopped) schedule(() => connect(opts), backoffMs(attempt++));
    };
    s.addEventListener("close", down);
    s.addEventListener("error", down);
  }

  function disconnect() {
    const s = socket;
    socket = null;
    if (s) {
      try {
        s.close();
      } catch {}
    }
  }

  function stop() {
    stopped = true;
    disconnect();
  }

  return { connect, disconnect, stop };
}

export type EventsClient = ReturnType<typeof createEventsClient>;
