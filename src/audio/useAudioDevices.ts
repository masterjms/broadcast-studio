/**
 * useAudioDevices.ts — 오디오 입력 장치 관리 훅.
 *
 * 예전 dshow 환경에서 장치를 못 잡던 문제를 구조적으로 막기 위한 견고화:
 *
 *  1) 권한 먼저: 권한을 받기 전에는 enumerateDevices가 label을 빈 문자열로
 *     준다(프라이버시). 그래서 먼저 getUserMedia로 권한을 트리거한 뒤 열거한다.
 *
 *  2) 핫플러그 감지: USB 마이크를 꽂거나 빼면 devicechange 이벤트가 온다.
 *     이를 구독해 목록을 자동 갱신한다.
 *
 *  3) 선택 장치 소실 폴백: 선택했던 마이크가 사라지면 기본 장치로 되돌리고
 *     사용자에게 알린다. (예전엔 이 경우 조용히 실패했다)
 *
 *  4) 선택 기억: 고른 장치를 localStorage에 저장해 다음 실행에 복원한다.
 *     단, 그 deviceId가 현재 목록에 있을 때만 사용한다.
 *
 *  5) 안정적 식별: 문자열 이름이 아니라 deviceId로 장치를 지정한다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { classifyAudioError, ClassifiedAudioError } from './audioErrors';

export interface AudioInputDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

export type PermissionState = 'unknown' | 'granted' | 'denied';

const STORAGE_KEY = 'gunpo.selectedMicId';

export interface UseAudioDevices {
  devices: AudioInputDevice[];
  selectedId: string | null;
  permission: PermissionState;
  error: ClassifiedAudioError | null;
  /** 권한을 요청하고 장치 목록을 채운다. 최초 1회 호출. */
  requestAndEnumerate: () => Promise<void>;
  /** 사용할 마이크를 선택한다. */
  selectDevice: (deviceId: string) => void;
  /** 목록을 수동 새로고침한다. */
  refresh: () => Promise<void>;
}

export function useAudioDevices(): UseAudioDevices {
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [error, setError] = useState<ClassifiedAudioError | null>(null);

  // 최신 selectedId를 이벤트 핸들러에서 참조하기 위한 ref
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;

  const enumerate = useCallback(async (): Promise<AudioInputDevice[]> => {
    const all = await navigator.mediaDevices.enumerateDevices();
    const inputs = all
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({
        deviceId: d.deviceId,
        label: d.label || '이름 없는 마이크',
        groupId: d.groupId,
      }));
    setDevices(inputs);
    return inputs;
  }, []);

  // 선택 장치가 현재 목록에 있는지 확인하고, 없으면 폴백
  const reconcileSelection = useCallback(
    (list: AudioInputDevice[]) => {
      if (list.length === 0) {
        setSelectedId(null);
        return;
      }
      const current = selectedRef.current;
      const stored =
        current ?? (typeof localStorage !== 'undefined'
          ? localStorage.getItem(STORAGE_KEY)
          : null);

      const exists = stored && list.some((d) => d.deviceId === stored);
      if (exists) {
        setSelectedId(stored);
      } else {
        // 선택 장치가 사라짐 → 첫 번째(보통 기본)로 폴백
        if (current && !exists) {
          setError({
            kind: 'no_device',
            message:
              '선택했던 마이크가 사라져 기본 마이크로 전환했습니다. 방송 전에 마이크를 확인해 주세요.',
            recoverable: true,
          });
        }
        setSelectedId(list[0].deviceId);
      }
    },
    [],
  );

  const requestAndEnumerate = useCallback(async () => {
    setError(null);
    try {
      // 권한 트리거: 임시 스트림을 열었다가 즉시 닫는다.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermission('granted');

      const list = await enumerate();
      reconcileSelection(list);
    } catch (e) {
      const classified = classifyAudioError(e);
      if (classified.kind === 'permission_denied') {
        setPermission('denied');
      }
      setError(classified);
    }
  }, [enumerate, reconcileSelection]);

  const refresh = useCallback(async () => {
    try {
      const list = await enumerate();
      reconcileSelection(list);
    } catch (e) {
      setError(classifyAudioError(e));
    }
  }, [enumerate, reconcileSelection]);

  const selectDevice = useCallback((deviceId: string) => {
    setSelectedId(deviceId);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, deviceId);
    }
    setError(null);
  }, []);

  // 핫플러그 감지: 장치 변경 시 목록 갱신 + 선택 재조정
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;
    const onChange = async () => {
      try {
        const list = await enumerate();
        reconcileSelection(list);
      } catch (e) {
        setError(classifyAudioError(e));
      }
    };
    navigator.mediaDevices.addEventListener('devicechange', onChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', onChange);
    };
  }, [enumerate, reconcileSelection]);

  return {
    devices,
    selectedId,
    permission,
    error,
    requestAndEnumerate,
    selectDevice,
    refresh,
  };
}