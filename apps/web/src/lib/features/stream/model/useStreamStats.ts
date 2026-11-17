import { useEffect, useRef, useState } from "react";

export type StreamStatsSnapshot = {
  width: number | null;
  height: number | null;
  fps: number | null;
  bitrateKbps: number | null;
  rttMs: number | null;
  relay: boolean | null;
  limitation: string | null;
};

const EMPTY_STATS: StreamStatsSnapshot = {
  width: null,
  height: null,
  fps: null,
  bitrateKbps: null,
  rttMs: null,
  relay: null,
  limitation: null,
};

type IStatsSample = {
  bytes: number;
  at: number;
};

const numberValue = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * Polls the peer connection once a second and turns raw RTC stats into the
 * line an admin can read: resolution, frame rate, bitrate, latency and whether
 * the media is going through the relay.
 */
export const useStreamStats = (
  connection: RTCPeerConnection | null,
  role: "host" | "viewer"
): StreamStatsSnapshot => {
  const [stats, setStats] = useState<StreamStatsSnapshot>(EMPTY_STATS);
  const previous = useRef<IStatsSample | null>(null);

  useEffect(() => {
    previous.current = null;
    setStats(EMPTY_STATS);
    if (!connection) return;

    let cancelled = false;

    const sample = async () => {
      let report: RTCStatsReport;
      try {
        report = await connection.getStats();
      } catch {
        return;
      }
      if (cancelled) return;

      const next: StreamStatsSnapshot = { ...EMPTY_STATS };
      const now = performance.now();
      let bytes: number | null = null;

      report.forEach((item) => {
        if (item.type !== (role === "host" ? "outbound-rtp" : "inbound-rtp")) {
          return;
        }
        if (item.kind !== "video" && item.mediaType !== "video") return;

        next.width = numberValue(item.frameWidth);
        next.height = numberValue(item.frameHeight);
        next.fps = numberValue(item.framesPerSecond);
        bytes = numberValue(
          role === "host" ? item.bytesSent : item.bytesReceived
        );
        if (
          role === "host" &&
          typeof item.qualityLimitationReason === "string"
        ) {
          next.limitation = item.qualityLimitationReason;
        }
      });

      report.forEach((item) => {
        if (item.type !== "candidate-pair") return;
        if (item.state !== "succeeded" || !(item.nominated || item.selected))
          return;

        next.rttMs =
          numberValue(item.currentRoundTripTime) !== null
            ? Math.round((item.currentRoundTripTime as number) * 1000)
            : null;

        const localId = item.localCandidateId;
        const local =
          typeof localId === "string" ? report.get(localId) : undefined;
        if (local && typeof local.candidateType === "string") {
          next.relay = local.candidateType === "relay";
        }
      });

      if (bytes !== null) {
        const last = previous.current;
        if (last && now > last.at) {
          next.bitrateKbps = Math.round(
            ((bytes - last.bytes) * 8) / (now - last.at)
          );
        }
        previous.current = { bytes, at: now };
      }

      setStats(next);
    };

    void sample();
    const timer = setInterval(() => void sample(), 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [connection, role]);

  return stats;
};
