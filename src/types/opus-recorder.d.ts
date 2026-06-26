declare module 'opus-recorder' {
  interface RecorderOptions {
    encoderPath?: string;
    mediaTrackConstraints?: MediaTrackConstraints;
    encoderSampleRate?: number;
    encoderApplication?: number;
    encoderFrameSize?: number;
    numberOfChannels?: number;
    streamPages?: boolean;
    maxFramesPerPage?: number;
  }

  export default class Recorder {
    static isRecordingSupported(): boolean;

    ondataavailable: ((data: Uint8Array) => void) | null;

    constructor(options?: RecorderOptions);

    start(): Promise<void>;
    stop(): Promise<void>;
  }
}
