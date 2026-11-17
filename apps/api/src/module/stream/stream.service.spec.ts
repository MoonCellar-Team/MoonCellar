import { StreamService, type StreamPeer } from "./stream.service";

type IMockPeer = StreamPeer & {
  viewerJoined: jest.Mock;
  viewerLeft: jest.Mock;
  stopped: jest.Mock;
  closed: jest.Mock;
  signal: jest.Mock;
};

const peer = (id: string): IMockPeer => ({
  id,
  viewerJoined: jest.fn(),
  viewerLeft: jest.fn(),
  stopped: jest.fn(),
  closed: jest.fn(),
  signal: jest.fn(),
});

describe("StreamService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      TURN_SECRET: "",
      TURN_URLS: "",
      STUN_URLS: "",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("issues a six-character code the host can read aloud", () => {
    const service = new StreamService();
    const host = peer("host");

    const response = service.host(host);

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(response.network.relay).toBe(false);
    expect(response.expiresAt).toBeGreaterThan(Date.now());
  });

  it("connects one viewer and relays signals both ways", () => {
    const service = new StreamService();
    const host = peer("host");
    const viewer = peer("viewer");
    const hosted = service.host(host);
    if (!hosted.ok) throw new Error("host failed");

    const joined = service.join(viewer, hosted.code.toLowerCase());
    expect(joined.ok).toBe(true);
    expect(host.viewerJoined).toHaveBeenCalledTimes(1);

    service.signal(host, { kind: "offer", sdp: "offer-sdp" });
    expect(viewer.signal).toHaveBeenCalledWith({
      kind: "offer",
      sdp: "offer-sdp",
    });

    service.signal(viewer, { kind: "answer", sdp: "answer-sdp" });
    expect(host.signal).toHaveBeenCalledWith({
      kind: "answer",
      sdp: "answer-sdp",
    });
  });

  it("refuses an unknown code and a second viewer", () => {
    const service = new StreamService();
    const host = peer("host");
    const viewer = peer("viewer");
    const other = peer("other");

    const missing = service.join(viewer, "ZZZZZZ");
    expect(missing.ok).toBe(false);

    const hosted = service.host(host);
    if (!hosted.ok) throw new Error("host failed");
    expect(service.join(viewer, hosted.code).ok).toBe(true);

    const full = service.join(other, hosted.code);
    expect(full.ok).toBe(false);
    expect("error" in full ? full.error : "").toContain("already watching");
  });

  it("lets the host remove a viewer without ending the room", () => {
    const service = new StreamService();
    const host = peer("host");
    const viewer = peer("viewer");
    const hosted = service.host(host);
    if (!hosted.ok) throw new Error("host failed");
    service.join(viewer, hosted.code);

    expect(service.kick(host).ok).toBe(true);
    expect(viewer.closed).toHaveBeenCalledWith({ reason: "removed" });
    expect(host.viewerLeft).toHaveBeenCalledTimes(1);
    expect(service.stats()).toEqual({ rooms: 1, viewers: 0 });
  });

  it("closes the room when the host stops and tells the viewer why", () => {
    const service = new StreamService();
    const host = peer("host");
    const viewer = peer("viewer");
    const hosted = service.host(host);
    if (!hosted.ok) throw new Error("host failed");
    service.join(viewer, hosted.code);

    expect(service.stop(host).ok).toBe(true);
    expect(viewer.closed).toHaveBeenCalledWith({ reason: "host-stopped" });
    expect(host.stopped).toHaveBeenCalledTimes(1);
    expect(service.stats().rooms).toBe(0);
  });

  it("notifies the viewer when the host disconnects", () => {
    const service = new StreamService();
    const host = peer("host");
    const viewer = peer("viewer");
    const hosted = service.host(host);
    if (!hosted.ok) throw new Error("host failed");
    service.join(viewer, hosted.code);

    service.disconnect(host);
    expect(viewer.closed).toHaveBeenCalledWith({ reason: "host-left" });
  });

  it("closes idle rooms after the two-hour window", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    try {
      const service = new StreamService();
      const host = peer("host");
      const viewer = peer("viewer");
      const hosted = service.host(host);
      if (!hosted.ok) throw new Error("host failed");
      service.join(viewer, hosted.code);

      expect(service.expire()).toBe(0);
      jest.setSystemTime(new Date("2026-01-01T02:00:01Z"));
      expect(service.expire()).toBe(1);
      expect(host.closed).toHaveBeenCalledWith({ reason: "idle" });
      expect(viewer.closed).toHaveBeenCalledWith({ reason: "idle" });
    } finally {
      jest.useRealTimers();
    }
  });

  it("issues relay credentials when the host is configured", () => {
    process.env.TURN_SECRET = "secret";
    process.env.TURN_URLS = "game.mooncellar.space:3478";
    const service = new StreamService();
    const hosted = service.host(peer("host"));
    if (!hosted.ok) throw new Error("host failed");

    expect(hosted.network.relay).toBe(true);
    expect(hosted.network.iceServers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          urls: ["turn:game.mooncellar.space:3478?transport=udp"],
          username: expect.stringMatching(/^\d+:[A-Z2-9]{6}$/),
          credential: expect.any(String),
        }),
        expect.objectContaining({
          urls: ["stun:game.mooncellar.space:3478"],
        }),
      ])
    );
  });
});
