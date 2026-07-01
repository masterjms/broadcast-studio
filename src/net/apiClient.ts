/**
 * apiClient.ts — 서버 HTTP API 클라이언트.
 *
 * 로그인으로 JWT를 받아 localStorage에 저장하고, 이후 모든 관리 API 요청에
 * Authorization: Bearer 헤더를 자동으로 붙인다. 같은 오리진(nginx가 서빙)이라
 * CORS가 없다.
 */

const TOKEN_KEY = 'castboard.jwt';

export interface UploadResult {
  ok: boolean;
  file_name: string;
  size: number;
  sha256: string;
  https_url: string;
}

export interface FileEntry {
  file_name: string;
  original_name: string;
  size: number;
  sha256: string;
  https_url: string;
}

export interface DeviceInfo {
  device_id: string;
  connected: boolean;
  audio_connected: boolean;
  since: number | null; // epoch seconds
}

export interface HealthSnapshot {
  ok: boolean;
  session: { state: string; session_id: number; file_id: number };
  cmd_devices: number;
  audio_devices: number;
  devices: DeviceInfo[];
  ingest_connected: boolean;
  live_stats: {
    sent: number;
    dropped_old: number;
    dropped_backlog: number;
    bursts: number;
  } | null;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    // 토큰 만료/무효 → 로그아웃 처리
    clearToken();
    throw new ApiError(401, 'session expired');
  }
  return res;
}

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, '아이디 또는 비밀번호가 올바르지 않습니다.');
  }
  const data = await res.json();
  setToken(data.token);
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await authedFetch('/upload', { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new ApiError(res.status, data.error || '업로드에 실패했습니다.');
  }
  return data;
}

export async function broadcastFile(fileName: string, devices?: string[]): Promise<void> {
  const body: Record<string, unknown> = { file_name: fileName };
  if (devices && devices.length > 0) body.devices = devices;
  const res = await authedFetch('/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new ApiError(res.status, data.error || '전송에 실패했습니다.');
  }
}

export async function deleteFile(fileName: string): Promise<void> {
  const res = await authedFetch(`/api/files/${encodeURIComponent(fileName)}`, {
    method: 'DELETE',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new ApiError(res.status, data.error || '삭제에 실패했습니다.');
  }
}

export async function getFiles(): Promise<FileEntry[]> {
  const res = await authedFetch('/api/files');
  const data = await res.json();
  return data.files ?? [];
}

export async function getHealth(): Promise<HealthSnapshot> {
  const res = await authedFetch('/api/health');
  return res.json();
}