"use client";

import { FC } from "react";
import { Badge } from "@/src/lib/shared/ui/Badge";
import type { StreamStatsSnapshot } from "../../model/useStreamStats";
import styles from "./StreamStats.module.scss";

interface IStreamStatsProps {
  stats: StreamStatsSnapshot;
  isConnected: boolean;
}

const formatBitrate = (kbps: number | null): string | null => {
  if (kbps === null) return null;
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mbit/s`;
  return `${kbps} kbit/s`;
};

export const StreamStats: FC<IStreamStatsProps> = ({ stats, isConnected }) => {
  const resolution =
    stats.width && stats.height ? `${stats.width} × ${stats.height}` : null;
  const bitrate = formatBitrate(stats.bitrateKbps);
  const relay = stats.relay === null ? null : stats.relay ? "Relay" : "Direct";

  return (
    <div className={styles.stats}>
      {!isConnected && <Badge tone="muted">Not connected</Badge>}
      {resolution && <Badge>{resolution}</Badge>}
      {stats.fps !== null && <Badge>{Math.round(stats.fps)} fps</Badge>}
      {bitrate && <Badge>{bitrate}</Badge>}
      {stats.rttMs !== null && <Badge>{stats.rttMs} ms</Badge>}
      {relay && (
        <Badge tone={stats.relay ? "attention" : "positive"} isWithDot>
          {relay}
        </Badge>
      )}
    </div>
  );
};
