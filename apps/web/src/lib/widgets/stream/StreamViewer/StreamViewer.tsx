"use client";

import { type FC, type FormEvent, useEffect, useRef, useState } from "react";
import { normalizeStreamCode } from "@mooncellar/schemas";
import { Badge } from "@/src/lib/shared/ui/Badge";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { EmptyState } from "@/src/lib/shared/ui/EmptyState";
import { SvgVideoPlay } from "@/src/lib/shared/ui/svg";
import {
  StreamCodeInput,
  StreamStats,
  useStreamViewer,
} from "@/src/lib/features/stream";
import styles from "./StreamViewer.module.scss";

interface IStreamViewerProps {
  code?: string;
}

export const StreamViewer: FC<IStreamViewerProps> = ({ code }) => {
  const viewer = useStreamViewer();
  const { status, error, remoteStream, connection, stats, join, leave } =
    viewer;

  const [value, setValue] = useState(normalizeStreamCode(code ?? ""));
  const [isMuted, setIsMuted] = useState(false);
  const [playBlocked, setPlayBlocked] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const isWatching =
    status === "connecting" || status === "waiting" || status === "live";

  useEffect(() => {
    setValue(normalizeStreamCode(code ?? ""));
  }, [code]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = remoteStream;
    video.muted = isMuted;
    if (remoteStream) {
      video
        .play()
        .then(() => setPlayBlocked(false))
        .catch(() => setPlayBlocked(true));
    }
  }, [remoteStream, isMuted]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value.length !== 6) return;
    join(value);
  };

  const play = () => {
    videoRef.current
      ?.play()
      .then(() => setPlayBlocked(false))
      .catch(() => undefined);
  };

  const fullscreen = () => {
    stageRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  const reset = () => {
    leave();
    setValue("");
  };

  if (status === "ended" || status === "error") {
    return (
      <div className={styles.ended}>
        <EmptyState
          title={status === "ended" ? "The stream ended" : "Could not connect"}
          description={
            error ??
            (status === "ended"
              ? "The host is no longer sharing."
              : "Check the code and try again.")
          }
          variant="inline"
          isWithoutImage
          action={
            <Button color={ButtonColor.ACCENT} onClick={reset}>
              {status === "ended" ? "Join another stream" : "Try another code"}
            </Button>
          }
        />
      </div>
    );
  }

  if (!isWatching) {
    return (
      <div className={styles.join}>
        <div className={styles.join__intro}>
          <span className={styles.join__eyebrow}>Watch a stream</span>
          <h2 className={styles.join__title}>
            Enter the code from the host&apos;s screen
          </h2>
          <p className={styles.join__text}>
            MoonStream connects two admin browsers directly. The host picks the
            screen after you join.
          </p>
        </div>

        <form className={styles.join__form} onSubmit={submit}>
          <StreamCodeInput
            value={value}
            onChange={setValue}
            error={error ?? undefined}
            autoFocus={!code}
          />
          <div className={styles.join__actions}>
            <Button
              color={ButtonColor.ACCENT}
              type="submit"
              disabled={value.length !== 6}
            >
              Watch stream
            </Button>
          </div>
        </form>

        <p className={styles.hint}>
          Watching is limited to MoonCellar administrators. The host can stop
          the stream or remove you at any time.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div ref={stageRef} className={styles.stage}>
        {remoteStream ? (
          <video ref={videoRef} className={styles.video} autoPlay playsInline />
        ) : (
          <div className={styles.placeholder}>
            <span className={styles.placeholder__icon}>
              <SvgVideoPlay size="40" />
            </span>
            <p className={styles.placeholder__title}>
              {status === "connecting"
                ? "Connecting to the host"
                : "Waiting for the host to choose a screen"}
            </p>
            <p className={styles.placeholder__text}>
              This page will start playing as soon as the host shares a screen.
            </p>
          </div>
        )}

        <div className={styles.stageTop}>
          <Badge
            tone={
              status === "live"
                ? "positive"
                : status === "connecting"
                  ? "attention"
                  : "muted"
            }
            isWithDot
          >
            {status === "live"
              ? "Live"
              : status === "connecting"
                ? "Connecting"
                : "Waiting"}
          </Badge>
          <div className={styles.stageTop__actions}>
            <Button
              color={ButtonColor.TRANSPARENT}
              compact
              onClick={() => setIsMuted((muted) => !muted)}
            >
              {isMuted ? "Unmute" : "Mute"}
            </Button>
            <Button
              color={ButtonColor.TRANSPARENT}
              compact
              onClick={fullscreen}
            >
              Fullscreen
            </Button>
            <Button color={ButtonColor.TRANSPARENT} compact onClick={reset}>
              Leave
            </Button>
          </div>
        </div>

        {playBlocked && (
          <button type="button" className={styles.play} onClick={play}>
            Play with sound
          </button>
        )}

        {remoteStream && (
          <div className={styles.stageBottom}>
            <StreamStats
              stats={stats}
              isConnected={connection === "connected"}
            />
          </div>
        )}
      </div>

      <p className={styles.hint}>
        Watching is limited to MoonCellar administrators. The host can stop the
        stream or remove you at any time.
      </p>
    </div>
  );
};
