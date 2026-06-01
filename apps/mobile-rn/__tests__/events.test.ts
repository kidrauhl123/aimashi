import { eventsUrlFor, backoffMs, createEventsClient } from "../src/api/events";

test("url + backoff", () => {
  expect(eventsUrlFor("https://c.test", 7)).toBe("wss://c.test/api/events?since_seq=7");
  expect(eventsUrlFor("http://c.test", 0)).toBe("ws://c.test/api/events?since_seq=0");
  expect(backoffMs(0)).toBe(1000);
  expect(backoffMs(2)).toBe(4000);
  expect(backoffMs(10)).toBe(30000);
});

test("连接用 mia-token subprotocol,分发 message,断线调度重连", () => {
  const sockets: any[] = [];
  class FakeWS {
    url: string;
    protocols: any;
    l: any = {};
    constructor(u: string, p: any) {
      this.url = u;
      this.protocols = p;
      sockets.push(this);
    }
    addEventListener(t: string, fn: any) {
      (this.l[t] ||= []).push(fn);
    }
    close() {
      (this.l.close || []).forEach((f: any) => f({}));
    }
    emit(t: string, e: any) {
      (this.l[t] || []).forEach((f: any) => f(e));
    }
  }
  const scheduled: any[] = [];
  const got: any[] = [];
  const c = createEventsClient({
    apiBase: "https://c.test",
    getToken: () => "TK",
    WebSocketImpl: FakeWS as any,
    scheduleReconnect: (fn) => scheduled.push(fn),
  });
  c.connect({ sinceSeq: () => 3, onEvent: (e) => got.push(e) });
  expect(sockets[0].url).toBe("wss://c.test/api/events?since_seq=3");
  expect(sockets[0].protocols).toEqual(["mia-token.TK"]);
  sockets[0].emit("message", { data: JSON.stringify({ type: "x", seq: 4 }) });
  expect(got[0].type).toBe("x");
  sockets[0].emit("close", {});
  expect(scheduled.length).toBe(1);
});
