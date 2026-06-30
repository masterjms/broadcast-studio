/**
 * ingestClient.ts — /ingest WebSocket 클라이언트.
 *
 * 서버 사양:
 *  - 연결 직후 첫 메시지로 {"type":"auth","token":"<JWT>"} 전송.
 *  - 이후 Opus packet을 binary로 전송(WSS binary 1개 = packet 1개).
 *  - 서버가 거부 시 close code로 사유 전달:
 *      4001 인증 실패 / 4003 단말 없음 / 4009 사용 중(다른 방송자/상태)
 *
 * 재접속: 네트워크 순단 시 지수 백오프로 자동 재연결한다. 단, 인증 실패(4001)
 * 같은 영구적 거부는 재시도하지 않는다.
 */

import { getToken } from './apiClient';

export type IngestState =
  | 'idle'
  | 'connecting'
  | 'authenticating'
  | 'live'
  | 'reconnecting'
  | 'rejected'
  | 'closed';

export interface IngestCallbacks {
  onStateChange?: (state: IngestState, detail?: string) => void;
}

const REJECT_REASONS: Record<number, string> = {
  4001: '인증에 실패했습니다. 다시 로그인해 주세요.',
  4003: '연결된 단말이 없습니다. 단말 상태를 확인해 주세요.',
  4009: '이미 다른 방송이 진행 중입니다.',
};

const FATAL_CODES = new Set([4001]); // 재시도하지 않는 영구 거부

export class IngestClient {
  private ws: WebSocket | null = null;
  private state: IngestState = 'idle';
  private wantOpen = false;
  private retry = 0;
  private retryTimer: number | null = null;

  constructor(private cb: IngestCallbacks = {}) {}

  getState(): IngestState {
    return this.state;
  }

  private setState(s: IngestState, detail?: string) {
    this.state = s;
    this.cb.onStateChange?.(s, detail);
  }

  private url(): string {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}/ingest`;
  }

  open(): void {
    if (this.wantOpen && this.ws) return; // 이미 연결 시도 중이면 무시(중복 방지)
    this.wantOpen = true;
    this.retry = 0;
    this.connect();
  }

  private connect(): void {
    const token = getToken();
    if (!token) {
      this.setState('rejected', '로그인이 필요합니다.');
      return;
    }
    // 직전 재연결 타이머가 남아있다면(이론상 발생 안 해야 하지만) 정리한다.
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    this.setState(this.retry > 0 ? 'reconnecting' : 'connecting');
    const ws = new WebSocket(this.url());
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      this.setState('authenticating');
      ws.send(JSON.stringify({ type: 'auth', token }));
      // 서버는 인증 성공 시 별도 ack 없이 방송을 시작한다.
      // 짧은 지연 후 live로 간주(거부 시 onclose가 먼저 온다).
      window.setTimeout(() => {
        if (this.ws === ws && ws.readyState === WebSocket.OPEN) {
          this.retry = 0;
          this.setState('live');
        }
      }, 300);
    };

    ws.onmessage = (ev) => {
      // 서버가 에러 메시지를 보낼 수 있음(거부 직전)
      if (typeof ev.data === 'string') {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'error') {
            this.setState('rejected', msg.reason);
          }
        } catch {
          /* ignore */
        }
      }
    };

    ws.onclose = (ev) => {
      // 이 클로저가 가리키던 ws가 이미 교체됐다면(빠른 stop→start),
      // 낡은 close 이벤트가 현재 연결의 상태를 덮어쓰지 않도록 무시한다.
      if (this.ws !== ws) return;

      this.ws = null;
      const reason = REJECT_REASONS[ev.code];
      if (reason) {
        this.setState('rejected', reason);
      }
      if (FATAL_CODES.has(ev.code) || !this.wantOpen) {
        if (!reason) this.setState('closed');
        return;
      }
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose가 이어서 호출되므로 여기서는 상태만 표시
    };
  }

  private scheduleReconnect(): void {
    this.retry += 1;
    const delay = Math.min(1000 * 2 ** (this.retry - 1), 15000); // 1s→15s
    this.setState('reconnecting', `${Math.round(delay / 1000)}초 후 재연결`);
    this.retryTimer = window.setTimeout(() => this.connect(), delay);
  }

  /** Opus packet 1개를 전송. live 상태가 아니면 조용히 무시(드롭). */
  sendFrame(packet: Uint8Array): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    // 백프레셔: 송신 버퍼가 과도하면 이번 프레임은 버린다(실시간 우선).
    if (ws.bufferedAmount > 1_000_000) return;
    ws.send(new Uint8Array(packet));
  }

  close(): void {
    this.wantOpen = false;
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'client stop');
      this.ws = null;
    }
    this.setState('idle');
  }
}
