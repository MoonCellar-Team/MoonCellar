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

export const stopMediaStream = (stream: MediaStream | null) => {
  stream?.getTracks().forEach((track) => track.stop());
};

export const hasAudio = (stream: MediaStream | null): boolean =>
  !!stream?.getAudioTracks().length;

/** What the page tells an admin about the current platform's picker. */
export const capturePlatformNote = (): {
  title: string;
  body: string;
} => {
  if (typeof navigator === "undefined") {
    return {
      title: "this browser",
      body: "The browser shows the operating system's own picker for screens, windows and tabs.",
    };
  }

  const userAgent = navigator.userAgent;
  if (/Windows/i.test(userAgent)) {
    return {
      title: "Windows",
      body: "Chrome and Edge use Windows Graphics Capture. Pick a screen, a window or a browser tab.",
    };
  }
  if (/Macintosh|Mac OS X/i.test(userAgent)) {
    return {
      title: "macOS",
      body: "The system picker uses ScreenCaptureKit. Allow screen recording for the browser in System Settings.",
    };
  }
  return {
    title: "Linux",
    body: "On Wayland the picker is powered by PipeWire and xdg-desktop-portal. On X11 the browser captures the screen directly.",
  };
};
