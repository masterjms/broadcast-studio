/**
 * OpusStreamCapture.ts — 마이크 → raw Opus 40ms 프레임.
 *
 * opus-recorder가 마이크 캡처 + Opus 인코딩(Ogg streamPages)을 담당하고,
 * OggOpusDemuxer가 Ogg 페이지에서 raw Opus packet만 추출한다.
 * 결과 packet은 서버 /ingest 사양에 정확히 맞는다(컨테이너 없는 raw, 40ms).
 *
 * 장치 선택은 useAudioDevices가 고른 deviceId를 mediaTrackConstraints로 넘긴다.
 * (문자열 이름이 아닌 deviceId로 지정 → 예전 dshow 이름 문제 회피)
 *
 * 준비물(빌드 시): opus-recorder의 인코더 워커/wasm을 public/에 복사해야 한다.
 *   node_modules/opus-recorder/dist/encoderWorker.min.js → public/opus/encoderWorker.min.js
 *   (해당 워커가 같은 폴더의 .wasm을 자동 로드한다)
 */

import Recorder from 'opus-recorder';
import { OggOpusDemuxer } from './oggOpus';
import { classifyAudioError, ClassifiedAudioError } from './audioErrors';

const SAMPLE_RATE = 16000;
const FRAME_MS = 40;
const ENCODER_PATH = '/opus/encoderWorker.min.js';

export interface OpusCaptureOptions {
  deviceId: string;
  onFrame: (opusPacket: Uint8Array) => void;
  onError?: (e: ClassifiedAudioError) => void;
  onLevel?: (rms: number) => void;   // 입력 레벨(0~1), UI 미터용
  gain?: number;                     // 초기 마이크 볼륨(기본 1.0)
}

export class OpusStreamCapture {
  private rec: Recorder | null = null;
  private demuxer = new OggOpusDemuxer();
  private running = false;

  get isRunning(): boolean {
    return this.running;
  }

  /** 방송 중 마이크 볼륨을 실시간으로 조절(1.0=기본). */
  setGain(gain: number): void {
    if (this.rec) {
      try {
        this.rec.setRecordingGain(gain);
      } catch {
        /* 아직 시작 전이면 무시 */
      }
    }
  }

  async start(opts: OpusCaptureOptions): Promise<void> {
    if (this.running) return;

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      opts.onError?.(classifyAudioError(new DOMException('insecure', 'SecurityError')));
      return;
    }
    if (!Recorder.isRecordingSupported()) {
      opts.onError?.(classifyAudioError(new DOMException('unsupported', 'NotSupportedError')));
      return;
    }

    this.demuxer = new OggOpusDemuxer();

    try {
      this.rec = new Recorder({
        encoderPath: ENCODER_PATH,
        mediaTrackConstraints: {
          deviceId: { exact: opts.deviceId },
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        encoderSampleRate: SAMPLE_RATE,
        encoderApplication: 2048,   // VOIP — 저지연 음성
        encoderFrameSize: FRAME_MS, // 40ms
        numberOfChannels: 1,
        streamPages: true,          // Ogg 페이지를 즉시 스트리밍(저지연)
        maxFramesPerPage: 1,        // 페이지당 1프레임 → 지연 최소화
        recordingGain: opts.gain ?? 1.0,  // 마이크 볼륨
      });

      // Ogg 페이지 → raw packet 추출 → 콜백
      this.rec.ondataavailable = (page: Uint8Array) => {
        const packets = this.demuxer.feed(page);
        for (const p of packets) {
          opts.onFrame(p);
        }
      };

      await this.rec.start();
      this.running = true;

      // 라이브 도중 마이크가 물리적으로 빠지거나 OS가 장치를 회수하면
      // 트랙이 'ended'된다. 조용히 끊기지 않도록 감지해서 알린다.
      const stream = this.rec.stream;
      if (stream) {
        for (const track of stream.getTracks()) {
          track.addEventListener('ended', () => {
            if (!this.running) return; // 이미 stop()으로 정리된 경우 무시
            opts.onError?.({
              kind: 'device_busy',
              message: '마이크 연결이 끊겼습니다. 케이블/USB 연결을 확인한 뒤 다시 시작해 주세요.',
              recoverable: true,
            });
            this.stop();
          });
        }
      }
    } catch (e) {
      await this.stop();
      opts.onError?.(classifyAudioError(e));
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.rec) {
      try {
        await this.rec.stop();
      } catch {
        /* already stopped */
      }
      this.rec.ondataavailable = null;
      this.rec = null;
    }
  }
}

export { SAMPLE_RATE, FRAME_MS };