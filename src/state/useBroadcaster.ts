/**
 * useBroadcaster.ts — 앱 상태 통합 훅.
 *
 * 캡처(OpusStreamCapture)와 송출(IngestClient)을 연결하고, 라이브/파일/상태를
 * 한곳에서 관리한다. UI 패널들은 이 훅이 노출하는 상태·동작만 사용한다.
 *
 * 라이브 흐름:
 *   startLive(deviceId)
 *     → IngestClient.open()  (서버에 /ingest 연결 + 인증 → 서버가 LIVE_START)
 *     → OpusStreamCapture.start(onFrame = ingest.sendFrame)
 *   stopLive()
 *     → capture.stop() + ingest.close()  (서버가 LIVE_STOP)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { OpusStreamCapture } from '../audio/OpusStreamCapture';
import { ClassifiedAudioError } from '../audio/audioErrors';
import { IngestClient, IngestState } from '../net/ingestClient';
import {
  isLoggedIn, login as apiLogin, clearToken,
  uploadFile, broadcastFile, getFiles, getHealth,
  FileEntry, HealthSnapshot,
} from '../net/apiClient';

export interface BroadcasterState {
  loggedIn: boolean;
  ingestState: IngestState;
  ingestDetail: string | null;
  audioError: ClassifiedAudioError | null;
  health: HealthSnapshot | null;
  files: FileEntry[];
  busy: boolean;

  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
  startLive: (deviceId: string) => Promise<void>;
  stopLive: () => Promise<void>;
  upload: (file: File) => Promise<void>;
  broadcast: (fileName: string) => Promise<void>;
  refreshFiles: () => Promise<void>;
}

export function useBroadcaster(): BroadcasterState {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [ingestState, setIngestState] = useState<IngestState>('idle');
  const [ingestDetail, setIngestDetail] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<ClassifiedAudioError | null>(null);
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const captureRef = useRef<OpusStreamCapture | null>(null);
  const ingestRef = useRef<IngestClient | null>(null);

  // health 폴링 (로그인 상태에서만)
  useEffect(() => {
    if (!loggedIn) return;
    let alive = true;
    const tick = async () => {
      try {
        const h = await getHealth();
        if (alive) setHealth(h);
      } catch {
        /* 401이면 authedFetch가 토큰 정리 → 다음 렌더에서 로그아웃 */
        if (alive && !isLoggedIn()) setLoggedIn(false);
      }
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => { alive = false; window.clearInterval(id); };
  }, [loggedIn]);

  const login = useCallback(async (u: string, p: string) => {
    await apiLogin(u, p);
    setLoggedIn(true);
  }, []);

  const logout = useCallback(() => {
    captureRef.current?.stop();
    ingestRef.current?.close();
    clearToken();
    setLoggedIn(false);
    setHealth(null);
  }, []);

  const startLive = useCallback(async (deviceId: string) => {
    if (captureRef.current?.isRunning || ingestRef.current) return; // 중복 시작 방지
    setAudioError(null);

    const ingest = new IngestClient({
      onStateChange: (s, detail) => {
        setIngestState(s);
        setIngestDetail(detail ?? null);
      },
    });
    ingestRef.current = ingest;
    ingest.open();

    const capture = new OpusStreamCapture();
    captureRef.current = capture;
    await capture.start({
      deviceId,
      onFrame: (packet) => ingest.sendFrame(packet),
      onError: (e) => {
        setAudioError(e);
        // 캡처 실패/중단 시 송출도 함께 정리하고 참조를 비워
        // 다시 '방송 시작'을 누를 수 있게 한다.
        capture.stop();
        ingest.close();
        if (captureRef.current === capture) captureRef.current = null;
        if (ingestRef.current === ingest) ingestRef.current = null;
      },
    });
  }, []);

  const stopLive = useCallback(async () => {
    await captureRef.current?.stop();
    ingestRef.current?.close();
    captureRef.current = null;
    ingestRef.current = null;
  }, []);

  const refreshFiles = useCallback(async () => {
    setFiles(await getFiles());
  }, []);

  const upload = useCallback(async (file: File) => {
    setBusy(true);
    try {
      await uploadFile(file);
      setFiles(await getFiles());
    } finally {
      setBusy(false);
    }
  }, []);

  const broadcast = useCallback(async (fileName: string) => {
    setBusy(true);
    try {
      await broadcastFile(fileName);
    } finally {
      setBusy(false);
    }
  }, []);

  // 최초 파일 목록 로드
  useEffect(() => {
    if (loggedIn) refreshFiles().catch(() => undefined);
  }, [loggedIn, refreshFiles]);

  return {
    loggedIn, ingestState, ingestDetail, audioError, health, files, busy,
    login, logout, startLive, stopLive, upload, broadcast, refreshFiles,
  };
}