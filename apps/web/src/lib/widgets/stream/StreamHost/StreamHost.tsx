"use client";

import { FC, useEffect, useRef, useState } from "react";
import { Badge, type BadgeTone } from "@/src/lib/shared/ui/Badge";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { Checkbox } from "@/src/lib/shared/ui/Checkbox";
import { Dropdown } from "@/src/lib/shared/ui/Dropdown";
import { Tabs } from "@/src/lib/shared/ui/Tabs";
import { SvgOpenWindow, SvgVideoPlay } from "@/src/lib/shared/ui/svg";
import { FRONT_URL } from "@/src/lib/shared/constants";
import { PAGE_SCROLL_ID } from "@/src/lib/shared/utils/common.utils";
import { toast } from "@/src/lib/shared/utils/toast.utils";
import {
  capturePlatformNote,
  listAudioInputs,
  screenCaptureSupported,
  STREAM_QUALITIES,
  StreamCaptureError,
  StreamCode,
  StreamStats,
  useStreamHost,
  type AudioInputDevice,
  type CapturePlatformNote,
  type StreamQualityId,
} from "@/src/lib/features/stream";
import styles from "./StreamHost.module.scss";

const NO_AUDIO = "none";
const SCREEN_AUDIO = "screen";
const WATCH_PATH = "/admin/stream/watch";

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
    audioSilent,
    screenAudio,
    audioDevice,
    relayAvailable,
    quality,
    stats,
    start,
    capture,
    stop,
    kickViewer,
    toggleAudio,
    addAudioDevice,
    selectScreenAudio,
    silenceAudio,
    setQuality,
  } = session;

  const [includeAudio, setIncludeAudio] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [supported, setSupported] = useState(true);
  const [audioInputs, setAudioInputs] = useState<AudioInputDevice[]>([]);
  const [platform, setPlatform] = useState<CapturePlatformNote>(() => ({
    title: "this browser",
    body: "The browser shows the operating system's own picker for screens, windows and tabs.",
    audioLabel: "Include audio",
    audioNote: null,
    audioHint: null,
  }));
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSupported(screenCaptureSupported());
    setPlatform(capturePlatformNote());
  }, []);

  useEffect(() => {
    let disposed = false;

    void (async () => {
      const permission = await navigator.permissions
        ?.query({ name: "microphone" })
        .catch(() => null);
      if (permission?.state !== "granted") return;

      try {
        const inputs = await listAudioInputs();
        if (!disposed) setAudioInputs(inputs);
      } catch {
        // The dropdown asks for the list again when it is first opened.
      }
    })();

    return () => {
      disposed = true;
    };
  }, []);

  const link = code ? `${FRONT_URL}${WATCH_PATH}/${code}` : "";
  const watchHref = code ? `${WATCH_PATH}/${code}` : WATCH_PATH;
  const badge = statusOf(status, viewerPresent, stream, connection);
  const selectedQuality =
    STREAM_QUALITIES.find((option) => option.id === quality) ??
    STREAM_QUALITIES[1];
  const audioSources = [
    { value: NO_AUDIO, label: "No sound" },
    ...(screenAudio
      ? [{ value: SCREEN_AUDIO, label: "Shared screen audio" }]
      : []),
    ...audioInputs.map((input) => ({
      value: input.deviceId,
      label: input.label,
    })),
  ];
  const activeAudioSource = audioSources.find((source) => {
    if (audioSilent) return source.value === NO_AUDIO;
    if (audioDevice) return source.value === audioDevice;
    if (screenAudio) return source.value === SCREEN_AUDIO;
    return source.value === NO_AUDIO;
  });
  const isAudioLive = !!stream && audioShared;

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

  const loadAudioInputs = async () => {
    try {
      const inputs = await listAudioInputs();
      setAudioInputs(inputs);
      if (!inputs.length) {
        toast.error({
          description: "No audio inputs were found on this computer.",
        });
      }
    } catch (listError) {
      toast.error({
        description:
          listError instanceof StreamCaptureError
            ? listError.message
            : "Audio inputs could not be listed.",
      });
    }
  };

  const selectAudioSource = async (index: number) => {
    const source = audioSources[index];
    if (!source) return;
    if (source.value === NO_AUDIO) {
      await silenceAudio();
      return;
    }
    if (source.value === SCREEN_AUDIO) {
      await selectScreenAudio();
      return;
    }

    try {
      await addAudioDevice(source.value);
    } catch (deviceError) {
      toast.error({
        description:
          deviceError instanceof StreamCaptureError
            ? deviceError.message
            : "The audio input could not be opened.",
      });
    }
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
                  {platform.audioLabel}
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
              <div className={styles.link__actions}>
                <Button
                  color={ButtonColor.DEFAULT}
                  href={watchHref}
                  target="_blank"
                  rel="noreferrer"
                  disabled={!link}
                  isOnlyIcon
                  tooltip="Open the viewer page in a new tab"
                >
                  <SvgOpenWindow size="16" />
                </Button>
                <Button
                  color={ButtonColor.DEFAULT}
                  onClick={copyLink}
                  disabled={!link}
                >
                  Copy link
                </Button>
              </div>
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

            <div className={styles.sound}>
              <span className={styles.label}>Sound</span>
              <Dropdown
                overflowRootId={PAGE_SCROLL_ID}
                placeholder="No input selected"
                isWithSearch={audioInputs.length === 0 ? true : undefined}
                list={audioSources.map((source) => source.label)}
                overwriteValue={activeAudioSource?.label ?? ""}
                getIndex={selectAudioSource}
                onLoad={audioInputs.length ? undefined : loadAudioInputs}
              />
            </div>

            <div className={styles.quality}>
              <span className={styles.label}>Quality</span>
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
                active={audioEnabled && isAudioLive}
                onClick={toggleAudio}
                disabled={!isAudioLive}
                tooltip={
                  audioShared
                    ? "Mute or unmute the shared audio"
                    : "No audio was included in this share"
                }
              >
                {audioEnabled && isAudioLive ? "Audio on" : "Audio off"}
              </Button>
            </div>

            {!audioShared && platform.audioNote && (
              <p className={styles.hint}>{platform.audioNote}</p>
            )}

            {!audioShared && platform.audioHint && (
              <Button
                color={ButtonColor.GHOST}
                isAccentText
                href={platform.audioHint.href}
                target="_blank"
                rel="noreferrer"
                className={styles.docsLink}
              >
                {platform.audioHint.label}
              </Button>
            )}

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
