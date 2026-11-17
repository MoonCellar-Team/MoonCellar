"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  normalizeStreamCode,
  StreamJoinRequestSchema,
  StreamSocketEvent,
  type IStreamClosedEvent,
  type IStreamJoinResponse,
  type IStreamNetwork,
  type IStreamSignalPayload,
} from "@mooncellar/schemas";
import { refreshAuth } from "@/src/lib/shared/hooks/useAuthRefresh";
import {
  getStreamSocket,
  type IStreamSocket,
} from "@/src/lib/shared/socket/stream.socket";
import { useStreamStats } from "./useStreamStats";

export type StreamViewerStatus =
  "idle" | "connecting" | "waiting" | "live" | "ended" | "error";

export type StreamViewerConnection = RTCPeerConnectionState | "idle" | "closed";

export type StreamViewerSession = {
  status: StreamViewerStatus;
  error: string | null;
  remoteStream: MediaStream | null;
  receivingVideo: boolean;
  hasAudio: boolean;
  connection: StreamViewerConnection;
  pc: RTCPeerConnection | null;
  join: (code: string) => void;
  leave: () => void;
};

const REAUTHENTICATE = "Unauthorized";

const closedMessage = (reason: IStreamClosedEvent["reason"]): string => {
  switch (reason) {
    case "host-left":
      return "The host left the stream.";
    case "host-stopped":
      return "The host stopped sharing.";
    case "removed":
      return "The host removed you from the stream.";
    case "idle":
      return "The code expired after two hours without activity.";
  }
};

export const useStreamViewer = (): StreamViewerSession & {
  stats: ReturnType<typeof useStreamStats>;
} => {
  const [status, setStatus] = useState<StreamViewerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [receivingVideo, setReceivingVideo] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [connection, setConnection] = useState<StreamViewerConnection>("idle");
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);

  const socketRef = useRef<IStreamSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const networkRef = useRef<IStreamNetwork | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const refreshedRef = useRef(false);
  const closedRef = useRef(false);
  const joiningRef = useRef(false);

  const stats = useStreamStats(pc, "viewer");

  const closePeer = useCallback(() => {
    const current = pcRef.current;
    if (current) {
      current.onicecandidate = null;
      current.onconnectionstatechange = null;
      current.ontrack = null;
      current.close();
    }
    pcRef.current = null;
    pendingIceRef.current = [];
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setPc(null);
    setRemoteStream(null);
    setReceivingVideo(false);
    setHasAudio(false);
    setConnection("idle");
  }, []);

  const sendSignal = useCallback((payload: IStreamSignalPayload) => {
    socketRef.current?.emit(
      StreamSocketEvent.SIGNAL,
      { payload },
      (response) => {
        if (!response.ok && !closedRef.current) setError(response.error);
      }
    );
  }, []);

  const flushIce = useCallback(() => {
    const current = pcRef.current;
    if (!current?.remoteDescription) return;
    for (const candidate of pendingIceRef.current.splice(0)) {
      current.addIceCandidate(candidate).catch(() => undefined);
    }
  }, []);

  const createPeer = useCallback(() => {
    const network = networkRef.current;
    if (!network || pcRef.current) return;

    const current = new RTCPeerConnection({
      iceServers: network.iceServers,
    });
    pcRef.current = current;
    setPc(current);

    const remote = new MediaStream();
    streamRef.current = remote;

    current.ontrack = (event) => {
      remote.addTrack(event.track);
      setRemoteStream(remote);
      if (event.track.kind === "video") setReceivingVideo(true);
      if (event.track.kind === "audio") setHasAudio(true);
      event.track.addEventListener("ended", () => {
        remote.removeTrack(event.track);
        if (event.track.kind === "video") setReceivingVideo(false);
        if (event.track.kind === "audio") setHasAudio(false);
        setRemoteStream(new MediaStream(remote.getTracks()));
      });
    };

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
      if (current.connectionState === "connected") {
        setStatus("live");
      }
      if (current.connectionState === "failed") {
        setStatus("error");
        setError(
          "The connection could not be established. Ask the host to share again."
        );
      }
    };
  }, [sendSignal]);

  const leave = useCallback(() => {
    socketRef.current?.emit(StreamSocketEvent.LEAVE, {});
    joiningRef.current = false;
    closePeer();
    setStatus("idle");
    setError(null);
    networkRef.current = null;
  }, [closePeer]);

  const join = useCallback(
    (rawCode: string) => {
      const parsed = StreamJoinRequestSchema.safeParse({ code: rawCode });
      if (!parsed.success) {
        setStatus("error");
        setError("Enter the six-character code shown on the host's screen.");
        return;
      }

      const code = normalizeStreamCode(parsed.data.code);
      if (code.length !== 6) {
        setStatus("error");
        setError("The code has six characters. Check it and try again.");
        return;
      }

      closePeer();
      networkRef.current = null;
      setError(null);
      setStatus("connecting");
      joiningRef.current = true;

      const socket = socketRef.current;
      if (!socket) {
        setStatus("error");
        setError("The signalling client is not ready. Reload the page.");
        return;
      }
      if (!socket.connected) socket.connect();

      socket.emit(
        StreamSocketEvent.JOIN,
        { code },
        (response: IStreamJoinResponse) => {
          if (!joiningRef.current || closedRef.current) return;
          if (!response.ok) {
            joiningRef.current = false;
            setStatus("error");
            setError(response.error);
            return;
          }
          networkRef.current = response.network;
          setStatus("waiting");
          createPeer();
        }
      );
    },
    [closePeer, createPeer]
  );

  const handleSignal = useCallback(
    async (payload: IStreamSignalPayload) => {
      if (payload.kind === "offer") {
        createPeer();
        const current = pcRef.current;
        if (!current) return;
        try {
          await current.setRemoteDescription({
            type: "offer",
            sdp: payload.sdp,
          });
          flushIce();
          const answer = await current.createAnswer();
          await current.setLocalDescription(answer);
          if (answer.sdp) sendSignal({ kind: "answer", sdp: answer.sdp });
          setStatus((currentStatus) =>
            currentStatus === "connecting" ? "waiting" : currentStatus
          );
        } catch {
          setStatus("error");
          setError(
            "The connection could not be established. Ask the host to share again."
          );
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
        const current = pcRef.current;
        if (current?.remoteDescription) {
          await current.addIceCandidate(candidate).catch(() => undefined);
        } else {
          pendingIceRef.current.push(candidate);
        }
      }
    },
    [createPeer, flushIce, sendSignal]
  );

  useEffect(() => {
    closedRef.current = false;
    let disposed = false;

    const connect = async () => {
      const socket = await getStreamSocket();
      if (disposed) return;
      socketRef.current = socket;

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

        joiningRef.current = false;
        setStatus("error");
        setError(
          socketError.message === "Forbidden"
            ? "MoonStream is available to administrators only."
            : socketError.message === "Unauthorized"
              ? "Your session expired. Sign in again and reload the page."
              : "Could not reach the signalling server. Reload the page and try again."
        );
      });

      socket.on(StreamSocketEvent.CLOSED, (event: IStreamClosedEvent) => {
        closePeer();
        joiningRef.current = false;
        setStatus("ended");
        setError(closedMessage(event.reason));
      });

      socket.on(StreamSocketEvent.SIGNAL, (event) => {
        void handleSignal(event.payload);
      });

      socket.on("disconnect", (reason) => {
        if (disposed || closedRef.current) return;
        if (reason === "io client disconnect") return;
        closePeer();
        joiningRef.current = false;
        setStatus("error");
        setError(
          "The signalling connection was lost. Join again with the code."
        );
      });

      socket.connect();
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
      closePeer();
    };
  }, [closePeer, handleSignal]);

  return {
    status,
    error,
    remoteStream,
    receivingVideo,
    hasAudio,
    connection,
    pc,
    stats,
    join,
    leave,
  };
};
