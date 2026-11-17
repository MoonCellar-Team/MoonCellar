export type StreamQualityId = "sharp" | "balanced" | "smooth" | "relay";

export type StreamQuality = {
  id: StreamQualityId;
  label: string;
  hint: string;
  maxBitrate: number;
  maxFramerate: number;
  contentHint: "detail" | "motion";
  degradationPreference:
    "maintain-resolution" | "balanced" | "maintain-framerate";
};

/**
 * The relay is deliberately limited by coturn in production. "Relay safe"
 * keeps a session under that cap; the other presets are for direct paths.
 */
export const STREAM_QUALITIES: StreamQuality[] = [
  {
    id: "sharp",
    label: "Sharp",
    hint: "Text and UI at up to 8 Mbit/s",
    maxBitrate: 8_000_000,
    maxFramerate: 30,
    contentHint: "detail",
    degradationPreference: "maintain-resolution",
  },
  {
    id: "balanced",
    label: "Balanced",
    hint: "Up to 3 Mbit/s, good for windows and slides",
    maxBitrate: 3_000_000,
    maxFramerate: 60,
    contentHint: "detail",
    degradationPreference: "balanced",
  },
  {
    id: "smooth",
    label: "Smooth",
    hint: "Up to 6 Mbit/s, keeps motion fluid",
    maxBitrate: 6_000_000,
    maxFramerate: 60,
    contentHint: "motion",
    degradationPreference: "maintain-framerate",
  },
  {
    id: "relay",
    label: "Relay safe",
    hint: "Up to 1.6 Mbit/s, fits the MoonCellar relay",
    maxBitrate: 1_600_000,
    maxFramerate: 30,
    contentHint: "motion",
    degradationPreference: "maintain-framerate",
  },
];

export const DEFAULT_STREAM_QUALITY: StreamQualityId = "balanced";

export const getStreamQuality = (id: StreamQualityId): StreamQuality =>
  STREAM_QUALITIES.find((quality) => quality.id === id) ?? STREAM_QUALITIES[1];

export const applyStreamQuality = async (
  sender: RTCRtpSender | null,
  id: StreamQualityId
) => {
  if (!sender) return;
  const quality = getStreamQuality(id);
  const params = sender.getParameters();

  if (params.encodings.length === 0) {
    params.encodings = [{}];
  }
  params.encodings[0] = {
    ...params.encodings[0],
    maxBitrate: quality.maxBitrate,
    maxFramerate: quality.maxFramerate,
  };
  params.degradationPreference = quality.degradationPreference;

  try {
    await sender.setParameters(params);
  } catch {
    // Some browsers reject parameters until the first connection is up.
  }
};

export const applyContentHint = (
  stream: MediaStream | null,
  id: StreamQualityId
) => {
  const videoTrack = stream?.getVideoTracks()[0];
  if (videoTrack) videoTrack.contentHint = getStreamQuality(id).contentHint;
};
