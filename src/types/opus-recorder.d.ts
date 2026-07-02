/**
 * opus-recorder 타입 선언 (라이브러리가 자체 타입을 제공하지 않으므로 직접 선언).
 * 우리가 실제로 쓰는 옵션·메서드만 선언한다.
 */
declare module 'opus-recorder' {
  interface RecorderConfig {
    encoderPath?: string;
    mediaTrackConstraints?: MediaTrackConstraints | boolean;
    encoderSampleRate?: number;
    encoderApplication?: number;   // 2048=VOIP, 2049=Audio
    encoderFrameSize?: number;     // ms
    numberOfChannels?: number;
    streamPages?: boolean;
    maxFramesPerPage?: number;
    encoderComplexity?: number;
    resampleQuality?: number;
    originalSampleRateOverride?: number;
    /** 녹음 입력 게인. 0~1 범위이며 기본값은 1. */
    recordingGain?: number;
  }

  export default class Recorder {
    constructor(config?: RecorderConfig);
    static isRecordingSupported(): boolean;
    ondataavailable: ((data: Uint8Array) => void) | null;
    onstart: (() => void) | null;
    onstop: (() => void) | null;
    onpause: (() => void) | null;
    onresume: (() => void) | null;
    /** start() 완료 후 채워지는 내부 마이크 스트림. (라이브러리 공개 프로퍼티) */
    stream?: MediaStream;
    start(): Promise<void>;
    stop(): Promise<void>;
    pause(): Promise<void>;
    resume(): void;
    /** 녹음 중 입력 게인을 조절한다. 값의 범위는 0~1. */
    setRecordingGain(gain: number): void;
    readonly state: string;
  }
}
