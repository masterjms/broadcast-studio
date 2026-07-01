/**
 * useBroadcaster.ts — 앱 상태 통합 훅.
 *
 * 캡처(OpusStreamCapture)와 송출(IngestClient)을 연결하고, 라이브/파일/단말
 * 선택을 한곳에서 관리한다. UI 패널들은 이 훅이 노출하는 상태·동작만 쓴다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { OpusStreamCapture } from '../audio/OpusStreamCapture';
import { ClassifiedAudioError } from '../audio/audioErrors';
import { IngestClient, IngestState } from '../net/ingestClient';
import {
  isLoggedIn, login as apiLogin, clearToken,
  uploadFile, broadcastFile, deleteFile, getFiles, getHealth,
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

  // 대상 단말 선택 (device_id 집합)
  selectedDevices: string[];
  toggleDevice: (deviceId: string) => void;
  selectAllDevices: () => void;
  clearDevices: () => void;

  // 라이브 옵션
  recordFlash: boolean;
  setRecordFlash: (v: boolean) => void;

  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
  startLive: (deviceId: string) => Promise<void>;
  stopLive: () => Promise<void>;
  upload: (file: File) => Promise<void>;
  broadcast: (fileName: string) => Promise<void>;
  removeFile: (fileName: string) => Promise<void>;
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
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [recordFlash, setRecordFlash] = useState(true);

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
        if (alive && !isLoggedIn()) setLoggedIn(false);
      }
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => { alive = false; window.clearInterval(id); };
  }, [loggedIn]);

  // 연결된 단말 목록이 바뀌면, 사라진 단말은 선택에서 제거
  useEffect(() => {
    const connected = new Set((health?.devices ?? [])
      .filter((d) => d.connected).map((d) => d.device_id));
    setSelectedDevices((prev) => prev.filter((id) => connected.has(id)));
  }, [health]);

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

  const toggleDevice = useCallback((deviceId: string) => {
    setSelectedDevices((prev) =>
      prev.includes(deviceId)
        ? prev.filter((id) => id !== deviceId)
        : [...prev, deviceId]);
  }, []);

  const selectAllDevices = useCallback(() => {
    const connected = (health?.devices ?? [])
      .filter((d) => d.connected).map((d) => d.device_id);
    setSelectedDevices(connected);
  }, [health]);

  const clearDevices = useCallback(() => setSelectedDevices([]), []);

  const startLive = useCallback(async (deviceId: string) => {
    if (captureRef.current?.isRunning || ingestRef.current) return;
    setAudioError(null);

    const ingest = new IngestClient(
      {
        onStateChange: (s, detail) => {
          setIngestState(s);
          setIngestDetail(detail ?? null);
        },
      },
      { recordFlash, devices: selectedDevices },
    );
    ingestRef.current = ingest;
    ingest.open();

    const capture = new OpusStreamCapture();
    captureRef.current = capture;
    await capture.start({
      deviceId,
      onFrame: (packet) => ingest.sendFrame(packet),
      onError: (e) => {
        setAudioError(e);
        capture.stop();
        ingest.close();
        if (captureRef.current === capture) captureRef.current = null;
        if (ingestRef.current === ingest) ingestRef.current = null;
      },
    });
  }, [recordFlash, selectedDevices]);

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
      await broadcastFile(fileName, selectedDevices);
    } finally {
      setBusy(false);
    }
  }, [selectedDevices]);

  const removeFile = useCallback(async (fileName: string) => {
    await deleteFile(fileName);
    setFiles(await getFiles());
  }, []);

  useEffect(() => {
    if (loggedIn) refreshFiles().catch(() => undefined);
  }, [loggedIn, refreshFiles]);

  return {
    loggedIn, ingestState, ingestDetail, audioError, health, files, busy,
    selectedDevices, toggleDevice, selectAllDevices, clearDevices,
    recordFlash, setRecordFlash,
    login, logout, startLive, stopLive, upload, broadcast, removeFile, refreshFiles,
  };
}