"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  StreamSocketEvent,
  type IStreamClosedEvent,
  type IStreamHostResponse,
  type IStreamNetwork,
  type IStreamSignalPayload,
} from "@mooncellar/schemas";
import { refreshAuth } from "@/src/lib/shared/hooks/useAuthRefresh";
import {
  getStreamSocket,
  type IStreamSocket,
} from "@/src/lib/shared/socket/stream.socket";
import {
  captureAudioInput,
  captureScreen,
  hasAudio,
  StreamCaptureError,
  stopMediaStream,
} from "./capture";
import {
  applyContentHint,
  applyStreamQuality,
  DEFAULT_STREAM_QUALITY,
  type StreamQualityId,
} from "./stream-quality";
import { useStreamStats } from "./useStreamStats";

export type StreamHostStatus = "connecting" | "ready" | "ended" | "error";

export type StreamHostConnection = RTCPeerConnectionState | "idle" | "closed";

export type StreamHostSession = {
  status: StreamHostStatus;
  code: string | null;
  error: string | null;
  viewerPresent: boolean;
  connection: StreamHostConnection;
  stream: MediaStream | null;
  audioShared: boolean;
  audioEnabled: boolean;
  audioSilent: boolean;
  screenAudio: boolean;
  audioDevice: string | null;
  relayAvailable: boolean;
  quality: StreamQualityId;
  pc: RTCPeerConnection | null;
  start: () => void;
  capture: (includeAudio: boolean) => Promise<void>;
  stop: () => void;
  kickViewer: () => void;
  toggleAudio: () => void;
  addAudioDevice: (deviceId: string) => Promise<void>;
  selectScreenAudio: () => Promise<void>;
  silenceAudio: () => Promise<void>;
  setQuality: (quality: StreamQualityId) => void;
};

const errorMessage = (error: unknown): string =>
  error instanceof StreamCaptureError
    ? error.message
    : "Something went wrong. Try again.";

const REAUTHENTICATE = "Unauthorized";

export const useStreamHost = (): StreamHostSession & {
  stats: ReturnType<typeof useStreamStats>;
} => {
  const [status, setStatus] = useState<StreamHostStatus>("connecting");
  const [code, setCode] = useState<string | null>(null);
  const [network, setNetwork] = useState<IStreamNetwork | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewerPresent, setViewerPresent] = useState(false);
  const [connection, setConnection] = useState<StreamHostConnection>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioShared, setAudioShared] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [audioSilent, setAudioSilent] = useState(false);
  const [screenAudio, setScreenAudio] = useState(false);
  const [audioDevice, setAudioDevice] = useState<string | null>(null);
  const [quality, setQualityState] = useState<StreamQualityId>(
    DEFAULT_STREAM_QUALITY
  );
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);

  const socketRef = useRef<IStreamSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const networkRef = useRef<IStreamNetwork | null>(null);
  const viewerRef = useRef(false);
  const qualityRef = useRef<StreamQualityId>(DEFAULT_STREAM_QUALITY);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenEndedRef = useRef<(() => void) | null>(null);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const deviceAudioRef = useRef<MediaStreamTrack | null>(null);
  const endSessionRef = useRef<(message?: string) => void>(() => undefined);
  const needsRoomRef = useRef(true);
  const refreshedRef = useRef(false);
  const closedRef = useRef(false);

  const stats = useStreamStats(pc, "host");

  const getAudioSender = useCallback(
    () =>
      pcRef.current
        ?.getTransceivers()
        .find((transceiver) => transceiver.receiver.track.kind === "audio")
        ?.sender ?? null,
    []
  );

  const finishPeer = useCallback(() => {
    const current = pcRef.current;
    if (current) {
      current.onicecandidate = null;
      current.onconnectionstatechange = null;
      current.close();
    }
    pcRef.current = null;
    pendingIceRef.current = [];
    setPc(null);
    setConnection("idle");
  }, []);

  const sendSignal = useCallback((payload: IStreamSignalPayload) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit(StreamSocketEvent.SIGNAL, { payload }, (response) => {
      if (!response.ok && !closedRef.current) setError(response.error);
    });
  }, []);

  const flushIce = useCallback(() => {
    const current = pcRef.current;
    if (!current?.remoteDescription) return;
    for (const candidate of pendingIceRef.current.splice(0)) {
      current.addIceCandidate(candidate).catch(() => undefined);
    }
  }, []);

  const handleSignal = useCallback(
    async (payload: IStreamSignalPayload) => {
      const current = pcRef.current;
      if (!current) return;

      if (payload.kind === "answer") {
        try {
          await current.setRemoteDescription({
            type: "answer",
            sdp: payload.sdp,
          });
          flushIce();
        } catch {
          setError("The browser could not complete the connection. Try again.");
        }
        return;
      }

      if (payload.kind === "ice") {
        const candidate: RTCIceCandidateInit = {
          candidate: payload.candidate,
          sdpMid: payload.sdpMid,
          sdpMLineIndex: payload.sdpMLineIndex,
          usernameFragment: payload.usernameFragment ?? null,
        };
        if (current.remoteDescription) {
          await current.addIceCandidate(candidate).catch(() => undefined);
        } else {
          pendingIceRef.current.push(candidate);
        }
      }
    },
    [flushIce]
  );

  const unbindScreenEnd = useCallback(() => {
    const track = screenTrackRef.current;
    const handler = screenEndedRef.current;
    if (track && handler) track.removeEventListener("ended", handler);
    screenTrackRef.current = null;
    screenEndedRef.current = null;
  }, []);

  const bindScreenEnd = useCallback((track: MediaStreamTrack) => {
    const handler = () => {
      endSessionRef.current("Screen sharing stopped.");
    };
    screenTrackRef.current = track;
    screenEndedRef.current = handler;
    track.addEventListener("ended", handler);
  }, []);

  const stopLocal = useCallback(() => {
    unbindScreenEnd();
    finishPeer();
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    audioTrackRef.current = null;
    deviceAudioRef.current?.stop();
    deviceAudioRef.current = null;
    setStream(null);
    setAudioShared(false);
    setAudioSilent(false);
    setScreenAudio(false);
    setAudioDevice(null);
    viewerRef.current = false;
    setViewerPresent(false);
    networkRef.current = null;
    setNetwork(null);
    setCode(null);
  }, [finishPeer, unbindScreenEnd]);

  const endSession = useCallback(
    (message?: string) => {
      const socket = socketRef.current;
      socket?.emit(StreamSocketEvent.STOP, {}, () => undefined);
      stopLocal();
      setStatus("ended");
      if (message) setError(message);
    },
    [stopLocal]
  );

  const negotiate = useCallback(async () => {
    const socket = socketRef.current;
    const currentNetwork = networkRef.current;
    const currentStream = streamRef.current;
    if (
      !socket ||
      !currentNetwork ||
      !currentStream ||
      !viewerRef.current ||
      pcRef.current
    ) {
      return;
    }

    const videoTrack = currentStream.getVideoTracks()[0];
    if (!videoTrack) return;

    const current = new RTCPeerConnection({
      iceServers: currentNetwork.iceServers,
    });
    pcRef.current = current;
    setPc(current);

    const video = current.addTransceiver(videoTrack, {
      direction: "sendonly",
      streams: [currentStream],
    });
    const audio = current.addTransceiver("audio", {
      direction: "sendonly",
      streams: [currentStream],
    });
    await audio.sender.replaceTrack(audioTrackRef.current);
    await applyStreamQuality(video.sender, qualityRef.current);
    applyContentHint(currentStream, qualityRef.current);

    current.onicecandidate = (event) => {
      const candidate = event.candidate;
      if (!candidate) return;
      sendSignal({
        kind: "ice",
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
        usernameFragment: candidate.usernameFragment,
      });
    };

    current.onconnectionstatechange = () => {
      if (closedRef.current) return;
      setConnection(current.connectionState);
      if (current.connectionState === "failed") {
        setError(
          "The connection could not be established. Share the screen again."
        );
      }
    };

    try {
      const offer = await current.createOffer();
      await current.setLocalDescription(offer);
      if (offer.sdp) sendSignal({ kind: "offer", sdp: offer.sdp });
    } catch {
      setError("The browser could not start the connection. Try again.");
      finishPeer();
    }
  }, [finishPeer, sendSignal]);

  const createRoom = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    setStatus("connecting");
    setError(null);
    socket.emit(StreamSocketEvent.HOST, {}, (response: IStreamHostResponse) => {
      if (closedRef.current) return;
      if (!response.ok) {
        needsRoomRef.current = false;
        setStatus("error");
        setError(response.error);
        return;
      }
      networkRef.current = response.network;
      setNetwork(response.network);
      setCode(response.code);
      setStatus("ready");
      needsRoomRef.current = false;
    });
  }, []);

  const start = useCallback(() => {
    setError(null);
    needsRoomRef.current = true;
    const socket = socketRef.current;
    if (socket?.connected) createRoom();
    else socket?.connect();
  }, [createRoom]);

  const capture = useCallback(
    async (includeAudio: boolean) => {
      setError(null);
      try {
        const nextStream = await captureScreen(includeAudio);
        const deviceTrack = deviceAudioRef.current;
        if (deviceTrack) streamRef.current?.removeTrack(deviceTrack);
        unbindScreenEnd();
        stopMediaStream(streamRef.current);
        streamRef.current = nextStream;
        setStream(nextStream);
        const screenHasAudio = hasAudio(nextStream);
        setScreenAudio(screenHasAudio);
        if (deviceTrack) {
          nextStream.addTrack(deviceTrack);
        } else {
          audioTrackRef.current = nextStream.getAudioTracks()[0] ?? null;
        }
        const audioTrack = audioTrackRef.current;
        setAudioShared(!!audioTrack);
        setAudioSilent(false);
        setAudioEnabled(true);
        applyContentHint(nextStream, qualityRef.current);

        const videoTrack = nextStream.getVideoTracks()[0];
        if (videoTrack) bindScreenEnd(videoTrack);

        const current = pcRef.current;
        if (current) {
          const transceivers = current.getTransceivers();
          const videoSender = transceivers.find(
            (transceiver) => transceiver.receiver.track.kind === "video"
          )?.sender;
          await videoSender?.replaceTrack(videoTrack ?? null);
          await getAudioSender()?.replaceTrack(audioTrack);
          await applyStreamQuality(videoSender ?? null, qualityRef.current);
        } else if (viewerRef.current) {
          await negotiate();
        }
      } catch (captureError) {
        setError(errorMessage(captureError));
      }
    },
    [bindScreenEnd, getAudioSender, negotiate, unbindScreenEnd]
  );

  const selectScreenAudio = useCallback(async () => {
    const deviceTrack = deviceAudioRef.current;
    if (deviceTrack) {
      deviceAudioRef.current = null;
      streamRef.current?.removeTrack(deviceTrack);
      deviceTrack.stop();
    }

    const screenTrack = streamRef.current?.getAudioTracks()[0] ?? null;
    if (!screenTrack) return;

    audioTrackRef.current = screenTrack;
    setAudioDevice(null);
    setAudioShared(true);
    setAudioSilent(false);
    await getAudioSender()?.replaceTrack(screenTrack);
  }, [getAudioSender]);

  const silenceAudio = useCallback(async () => {
    const deviceTrack = deviceAudioRef.current;
    if (deviceTrack) {
      deviceAudioRef.current = null;
      streamRef.current?.removeTrack(deviceTrack);
      deviceTrack.stop();
    }

    audioTrackRef.current = null;
    setAudioDevice(null);
    setAudioShared(false);
    setAudioSilent(true);
    await getAudioSender()?.replaceTrack(null);
  }, [getAudioSender]);

  const addAudioDevice = useCallback(
    async (deviceId: string) => {
      const track = await captureAudioInput(deviceId);

      await selectScreenAudio();
      streamRef.current?.addTrack(track);
      deviceAudioRef.current = track;
      audioTrackRef.current = track;
      setAudioDevice(deviceId);
      setAudioShared(true);
      setAudioSilent(false);
      setAudioEnabled(true);
      await getAudioSender()?.replaceTrack(track);
    },
    [getAudioSender, selectScreenAudio]
  );

  const stop = useCallback(() => {
    endSession();
  }, [endSession]);

  const kickViewer = useCallback(() => {
    socketRef.current?.emit(StreamSocketEvent.KICK, {}, (response) => {
      if (!response.ok && !closedRef.current) setError(response.error);
    });
  }, []);

  const toggleAudio = useCallback(() => {
    const track = audioTrackRef.current;
    if (!track) return;
    const enabled = !track.enabled;
    track.enabled = enabled;
    setAudioEnabled(enabled);
  }, []);

  const setQuality = useCallback((next: StreamQualityId) => {
    qualityRef.current = next;
    setQualityState(next);
    applyContentHint(streamRef.current, next);
    const sender = pcRef.current
      ?.getTransceivers()
      .find(
        (transceiver) => transceiver.receiver.track.kind === "video"
      )?.sender;
    void applyStreamQuality(sender ?? null, next);
  }, []);

  useEffect(() => {
    closedRef.current = false;
    let disposed = false;

    const connect = async () => {
      const socket = await getStreamSocket();
      if (disposed) return;
      socketRef.current = socket;

      socket.on("connect", () => {
        if (needsRoomRef.current) createRoom();
      });

      socket.on("connect_error", async (socketError) => {
        if (disposed || closedRef.current) return;
        if (socketError.message === REAUTHENTICATE && !refreshedRef.current) {
          refreshedRef.current = true;
          try {
            await refreshAuth();
            socket.connect();
            return;
          } catch {
            // Fall through to the message below.
          }
        }

        needsRoomRef.current = false;
        setStatus("error");
        setError(
          socketError.message === "Forbidden"
            ? "MoonStream is available to administrators only."
            : socketError.message === "Unauthorized"
              ? "Your session expired. Sign in again and reload the page."
              : "Could not reach the signalling server. Reload the page and try again."
        );
      });

      socket.on(StreamSocketEvent.VIEWER_JOINED, () => {
        viewerRef.current = true;
        setViewerPresent(true);
        if (streamRef.current && !pcRef.current) void negotiate();
      });

      socket.on(StreamSocketEvent.VIEWER_LEFT, () => {
        viewerRef.current = false;
        setViewerPresent(false);
        finishPeer();
      });

      socket.on(StreamSocketEvent.STOPPED, () => {
        stopLocal();
        setStatus("ended");
      });

      socket.on(StreamSocketEvent.CLOSED, (event: IStreamClosedEvent) => {
        stopLocal();
        setStatus("ended");
        setError(
          event.reason === "idle"
            ? "The code expired after two hours without activity."
            : "The signalling connection was closed."
        );
      });

      socket.on(StreamSocketEvent.SIGNAL, (event) => {
        void handleSignal(event.payload);
      });

      socket.on("disconnect", (reason) => {
        if (disposed || closedRef.current) return;
        if (reason === "io client disconnect") return;
        needsRoomRef.current = false;
        stopLocal();
        setStatus("error");
        setError(
          "The signalling connection was lost. Start a new stream to get a fresh code."
        );
      });

      if (socket.connected) createRoom();
      else socket.connect();
    };

    void connect();

    return () => {
      disposed = true;
      closedRef.current = true;
      const socket = socketRef.current;
      if (socket) {
        socket.emit(StreamSocketEvent.LEAVE, {});
        socket.removeAllListeners();
        socket.disconnect();
      }
      unbindScreenEnd();
      finishPeer();
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    };
  }, [
    createRoom,
    finishPeer,
    handleSignal,
    negotiate,
    stopLocal,
    unbindScreenEnd,
  ]);

  return {
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
    relayAvailable: network?.relay ?? false,
    quality,
    pc,
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
  };
};
