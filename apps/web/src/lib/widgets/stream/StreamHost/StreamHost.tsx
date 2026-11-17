"use client";

import { FC, useEffect, useRef, useState } from "react";
import { Badge, type BadgeTone } from "@/src/lib/shared/ui/Badge";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { Checkbox } from "@/src/lib/shared/ui/Checkbox";
import { Tabs } from "@/src/lib/shared/ui/Tabs";
import { SvgVideoPlay } from "@/src/lib/shared/ui/svg";
import { FRONT_URL } from "@/src/lib/shared/constants";
import { toast } from "@/src/lib/shared/utils/toast.utils";
import {
  capturePlatformNote,
  screenCaptureSupported,
  STREAM_QUALITIES,
  StreamCode,
  StreamStats,
  useStreamHost,
  type StreamQualityId,
} from "@/src/lib/features/stream";
import styles from "./StreamHost.module.scss";

const statusOf = (
  status: ReturnType<typeof useStreamHost>["status"],
  viewerPresent: boolean,
  stream: MediaStream | null,
  connection: ReturnType<typeof useStreamHost>["connection"]
): { label: string; tone: BadgeTone } => {
  if (status === "connecting") return { label: "Starting", tone: "muted" };
  if (status === "ended") return { label: "Ended", tone: "muted" };
  if (status === "error") return { label: "Error", tone: "negative" };
  if (!stream && viewerPresent) {
    return { label: "Viewer waiting", tone: "attention" };
  }
  if (!stream) return { label: "Ready", tone: "muted" };
  if (connection === "connected") return { label: "Live", tone: "positive" };
  if (viewerPresent) return { label: "Connecting", tone: "attention" };
  return { label: "Preview", tone: "accent" };
};

const qualityIndex = (quality: StreamQualityId) =>
  Math.max(
    0,
    STREAM_QUALITIES.findIndex((option) => option.id === quality)
  );

export const StreamHost: FC = () => {
  const session = useStreamHost();
  const {
    status,
    code,
    error,
    viewerPresent,
    connection,
    stream,
    audioShared,
    audioEnabled,
    relayAvailable,
    quality,
    stats,
    start,
    capture,
    stop,
    kickViewer,
    toggleAudio,
    setQuality,
  } = session;

  const [includeAudio, setIncludeAudio] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [supported, setSupported] = useState(true);
  const [platform, setPlatform] = useState(() => ({
    title: "this browser",
    body: "The browser shows the operating system's own picker for screens, windows and tabs.",
  }));
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSupported(screenCaptureSupported());
    setPlatform(capturePlatformNote());
  }, []);

  const link = code ? `${FRONT_URL}/admin/stream/watch/${code}` : "";
  const badge = statusOf(status, viewerPresent, stream, connection);
  const selectedQuality =
    STREAM_QUALITIES.find((option) => option.id === quality) ??
    STREAM_QUALITIES[1];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) {
      video.play().catch(() => undefined);
    }
  }, [stream]);

  const share = async () => {
    setIsStarting(true);
    try {
      await capture(includeAudio);
    } finally {
      setIsStarting(false);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success({ description: "Viewer link copied" });
    } catch {
      toast.error({
        description: "Could not copy the link. Select it instead.",
      });
    }
  };

  const enterFullscreen = () => {
    stageRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div className={styles.root}>
      <div className={styles.layout}>
        <div className={styles.main}>
          <div
            ref={stageRef}
            className={styles.stage}
            data-state={viewerPresent ? "live" : "preview"}
          >
            {stream ? (
              <video
                ref={videoRef}
                className={styles.video}
                muted
                autoPlay
                playsInline
              />
            ) : (
              <div className={styles.placeholder}>
                <span className={styles.placeholder__icon}>
                  <SvgVideoPlay size="40" />
                </span>
                <p className={styles.placeholder__title}>
                  {status === "connecting"
                    ? "Preparing your code"
                    : status === "ended"
                      ? "Stream ended"
                      : status === "error"
                        ? "The stream did not start"
                        : viewerPresent
                          ? "Your viewer is waiting"
                          : "Nothing is being shared yet"}
                </p>
                <p className={styles.placeholder__text}>
                  {status === "connecting"
                    ? "The code appears here in a moment."
                    : status === "ended"
                      ? "Start a new stream to get a fresh code."
                      : status === "error"
                        ? "The message below says what happened. Try again for a new code."
                        : viewerPresent
                          ? "Choose a screen, a window or a tab to start the stream."
                          : "The code is ready. Pick a source when you want to go live."}
                </p>
              </div>
            )}

            <div className={styles.stageTop}>
              <Badge tone={badge.tone} isWithDot>
                {badge.label}
              </Badge>
              {stream && (
                <Button
                  color={ButtonColor.TRANSPARENT}
                  compact
                  onClick={enterFullscreen}
                >
                  Fullscreen
                </Button>
              )}
            </div>

            {stream && (
              <div className={styles.stageBottom}>
                <StreamStats
                  stats={stats}
                  isConnected={connection === "connected"}
                />
              </div>
            )}
          </div>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          {!supported && (
            <p className={styles.note}>
              This browser cannot capture a screen. Open MoonCellar in a desktop
              Chrome, Edge or Firefox over HTTPS.
            </p>
          )}

          <div className={styles.actions}>
            {status === "ended" || status === "error" ? (
              <Button color={ButtonColor.ACCENT} onClick={start}>
                {status === "error" ? "Try again" : "Start a new stream"}
              </Button>
            ) : stream ? (
              <>
                <Button
                  color={ButtonColor.DEFAULT}
                  onClick={share}
                  isLoading={isStarting}
                >
                  Share another screen
                </Button>
                <Button color={ButtonColor.RED} onClick={stop}>
                  Stop stream
                </Button>
              </>
            ) : (
              <>
                <Button
                  color={ButtonColor.ACCENT}
                  onClick={share}
                  isLoading={isStarting}
                  disabled={!supported || !code}
                >
                  Share a screen
                </Button>
                <label className={styles.check}>
                  <Checkbox
                    checked={includeAudio}
                    onChange={(event) => setIncludeAudio(event.target.checked)}
                  />
                  Include system audio
                </label>
              </>
            )}
            {code && !stream && status !== "ended" && status !== "error" && (
              <Button color={ButtonColor.TRANSPARENT} onClick={stop}>
                End session
              </Button>
            )}
            {viewerPresent && (
              <Button
                color={ButtonColor.TRANSPARENT}
                onClick={kickViewer}
                tooltip="Remove the current viewer"
              >
                Remove viewer
              </Button>
            )}
          </div>

          <div className={styles.platform}>
            <p className={styles.platform__title}>
              Capture on {platform.title}
            </p>
            <p className={styles.platform__text}>{platform.body}</p>
          </div>
        </div>

        <aside className={styles.side}>
          <section className={styles.panel}>
            {code ? (
              <StreamCode code={code} />
            ) : (
              <div className={styles.preparing}>
                <span className={styles.preparing__label}>Stream code</span>
                <span className={styles.preparing__value}>
                  {status === "connecting" ? "Creating…" : "— — — — — —"}
                </span>
              </div>
            )}

            <div className={styles.link}>
              <code className={styles.link__value} title={link}>
                {link || "The link appears with the code."}
              </code>
              <Button
                color={ButtonColor.DEFAULT}
                onClick={copyLink}
                disabled={!link}
                compact
              >
                Copy link
              </Button>
            </div>

            <p className={styles.hint}>
              Anyone with this code and an admin account can watch. The code
              works while this tab stays open.
            </p>
          </section>

          <section className={styles.panel}>
            <dl className={styles.status}>
              <div>
                <dt>Viewer</dt>
                <dd>{viewerPresent ? "Watching" : "Waiting"}</dd>
              </div>
              <div>
                <dt>Sharing</dt>
                <dd>
                  {stream
                    ? audioShared
                      ? "Screen and audio"
                      : "Screen"
                    : "Not yet"}
                </dd>
              </div>
              <div>
                <dt>Path</dt>
                <dd>
                  {stats.relay === null
                    ? "—"
                    : stats.relay
                      ? "TURN relay"
                      : "Direct"}
                </dd>
              </div>
            </dl>

            <div className={styles.quality}>
              <span className={styles.quality__label}>Quality</span>
              <Tabs
                theme="segmented"
                ariaLabel="Stream quality"
                isWrap
                isFit
                defaultTabIndex={qualityIndex(quality)}
                isUseDefaultIndex
                contents={STREAM_QUALITIES.map((option) => ({
                  tabName: option.label,
                  onTabClick: () => setQuality(option.id),
                }))}
              />
              <span className={styles.quality__hint}>
                {selectedQuality.hint}
              </span>
            </div>

            <div className={styles.toggle}>
              <Button
                color={ButtonColor.DEFAULT}
                active={audioEnabled && audioShared}
                onClick={toggleAudio}
                disabled={!stream || !audioShared}
                tooltip={
                  audioShared
                    ? "Mute or unmute the shared system audio"
                    : "No system audio was shared"
                }
              >
                {audioEnabled && audioShared ? "Audio on" : "Audio off"}
              </Button>
            </div>

            {relayAvailable && (
              <p className={styles.hint}>
                A TURN relay is available. The relay caps a session at about 2
                Mbit/s; use Relay safe when the path is relayed.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
};
