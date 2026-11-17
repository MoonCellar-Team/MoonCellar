export type StreamCaptureErrorCode =
  "insecure" | "unsupported" | "denied" | "failed";

export class StreamCaptureError extends Error {
  constructor(
    readonly code: StreamCaptureErrorCode,
    message: string
  ) {
    super(message);
    this.name = "StreamCaptureError";
  }
}

type ScreenCaptureOptions = DisplayMediaStreamOptions & {
  systemAudio?: "include" | "exclude";
  selfBrowserSurface?: "include" | "exclude";
  surfaceSwitching?: "include" | "exclude";
};

export type CapturePlatformNote = {
  title: string;
  body: string;
  /** Label for the switch that asks for sound with the capture. */
  audioLabel: string;
  /**
   * How to include sound where the platform cannot capture the desktop's, or
   * `null` when the picker itself decides.
   */
  audioNote: string | null;
  /** Where the panel sends the host for the virtual-input recipe. */
  audioHint: { label: string; href: string } | null;
};

export const screenCaptureSupported = (): boolean =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  !!navigator.mediaDevices?.getDisplayMedia;

/**
 * Asks the operating system for a screen, a window or a tab. The picker is the
 * OS picker: PipeWire on Wayland, X11 on X11, Windows Graphics Capture on
 * Windows and ScreenCaptureKit on macOS. The browser never guesses a source.
 */
export const captureScreen = async (
  includeAudio: boolean
): Promise<MediaStream> => {
  if (typeof window === "undefined" || !window.isSecureContext) {
    throw new StreamCaptureError(
      "insecure",
      "Screen sharing needs HTTPS. Open MoonCellar over https:// or on localhost."
    );
  }

  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new StreamCaptureError(
      "unsupported",
      "This browser cannot share a screen. Use a desktop Chrome, Edge or Firefox."
    );
  }

  const options: ScreenCaptureOptions = {
    video: {
      frameRate: { ideal: 60, max: 60 },
      width: { max: 1920 },
      height: { max: 1080 },
    },
    audio: includeAudio
      ? {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      : false,
    systemAudio: includeAudio ? "include" : "exclude",
    selfBrowserSurface: "exclude",
    surfaceSwitching: "include",
  };

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia(options);
    stream.getVideoTracks().forEach((track) => {
      track.contentHint = "detail";
    });
    stream.getAudioTracks().forEach((track) => {
      track.contentHint = "music";
    });
    return stream;
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";

    if (name === "NotAllowedError" || name === "AbortError") {
      throw new StreamCaptureError(
        "denied",
        "Screen sharing was cancelled. Choose a screen to start the stream."
      );
    }
    if (name === "NotSupportedError" || name === "TypeError") {
      throw new StreamCaptureError(
        "unsupported",
        "This browser cannot capture that source. Pick a screen or a window."
      );
    }
    throw new StreamCaptureError(
      "failed",
      "The screen could not be shared. Try again."
    );
  }
};

export type AudioInputDevice = {
  deviceId: string;
  label: string;
};

const describeAudioInputs = (devices: MediaDeviceInfo[]): AudioInputDevice[] =>
  devices
    .filter((device) => device.kind === "audioinput" && device.deviceId)
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Audio input ${index + 1}`,
    }));

/**
 * The inputs a host can send as sound. Their labels stay empty until the page
 * has microphone access, so a first visit asks for it here — neither the screen
 * capture nor the picker grants that permission.
 */
export const listAudioInputs = async (): Promise<AudioInputDevice[]> => {
  if (!navigator.mediaDevices?.enumerateDevices) {
    throw new StreamCaptureError(
      "unsupported",
      "This browser cannot list audio inputs."
    );
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = devices.filter((device) => device.kind === "audioinput");
  if (inputs.length && inputs.every((device) => !!device.label)) {
    return describeAudioInputs(devices);
  }

  const permission = await navigator.mediaDevices
    .getUserMedia({ audio: true })
    .catch(() => null);
  permission?.getTracks().forEach((track) => track.stop());

  if (!permission) {
    throw new StreamCaptureError(
      "denied",
      "The browser blocked microphone access. Allow it for this site to list audio inputs."
    );
  }

  return describeAudioInputs(await navigator.mediaDevices.enumerateDevices());
};

/**
 * Opens one audio input, by default a device the host chose: on Linux this is
 * how the desktop's sound reaches the stream, because Chromium never captures
 * it from the screen.
 */
export const captureAudioInput = async (
  deviceId: string
): Promise<MediaStreamTrack> => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new StreamCaptureError(
      "unsupported",
      "This browser cannot open audio inputs."
    );
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    const track = stream.getAudioTracks()[0];
    if (!track) throw new Error("The input returned no audio track");
    track.contentHint = "music";
    return track;
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";

    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new StreamCaptureError(
        "denied",
        "The browser blocked microphone access. Allow it for this site and try again."
      );
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      throw new StreamCaptureError(
        "unsupported",
        "That audio input is no longer available. Pick another one."
      );
    }
    throw new StreamCaptureError(
      "failed",
      "The audio input could not be opened. Try another one."
    );
  }
};

export const stopMediaStream = (stream: MediaStream | null) => {
  stream?.getTracks().forEach((track) => track.stop());
};

export const hasAudio = (stream: MediaStream | null): boolean =>
  !!stream?.getAudioTracks().length;

/** What the page tells an admin about the current platform's picker. */
export const capturePlatformNote = (): CapturePlatformNote => {
  if (typeof navigator === "undefined") {
    return {
      title: "this browser",
      body: "The browser shows the operating system's own picker for screens, windows and tabs.",
      audioLabel: "Include audio",
      audioNote: null,
      audioHint: null,
    };
  }

  const userAgent = navigator.userAgent;
  if (/Windows/i.test(userAgent)) {
    return {
      title: "Windows",
      body: "Chrome and Edge use Windows Graphics Capture. Pick a screen, a window or a browser tab.",
      audioLabel: "Include system audio",
      audioNote: null,
      audioHint: null,
    };
  }
  if (/CrOS/i.test(userAgent)) {
    return {
      title: "ChromeOS",
      body: "Chrome captures this device's screens and windows directly.",
      audioLabel: "Include system audio",
      audioNote: null,
      audioHint: null,
    };
  }
  if (/Macintosh|Mac OS X/i.test(userAgent)) {
    return {
      title: "macOS",
      body: "The system picker uses ScreenCaptureKit. Allow screen recording for the browser in System Settings.",
      audioLabel: "Include audio",
      audioNote:
        "Chrome sends only a browser tab's sound on macOS: pick the tab in the picker and turn on “Also share tab audio”.",
      audioHint: null,
    };
  }
  return {
    title: "Linux",
    body: "On Wayland the picker is powered by PipeWire and xdg-desktop-portal. On X11 the browser captures the screen directly.",
    audioLabel: "Include audio",
    audioNote:
      "Chromium records only a browser tab's sound on Linux. Share the tab with “Also share tab audio”, or pick a virtual input under Sound.",
    audioHint: {
      label: "How to create a virtual input",
      href: "https://docs.mooncellar.space/stream#linux-a-virtual-input",
    },
  };
};
