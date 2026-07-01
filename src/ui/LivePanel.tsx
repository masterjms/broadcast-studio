import { useEffect } from 'react';
import { useAudioDevices } from '../audio/useAudioDevices';
import { ClassifiedAudioError } from '../audio/audioErrors';
import { IngestState } from '../net/ingestClient';

interface Props {
  ingestState: IngestState;
  ingestDetail: string | null;
  audioError: ClassifiedAudioError | null;
  recordFlash: boolean;
  onRecordFlashChange: (v: boolean) => void;
  selectedCount: number;
  onStart: (deviceId: string) => void;
  onStop: () => void;
}

const STATE_LABEL: Record<IngestState, string> = {
  idle: '대기',
  connecting: '연결 중',
  authenticating: '인증 중',
  live: 'ON AIR',
  reconnecting: '재연결 중',
  rejected: '거부됨',
  closed: '종료',
};

export function LivePanel({
  ingestState, ingestDetail, audioError, recordFlash, onRecordFlashChange,
  selectedCount, onStart, onStop,
}: Props) {
  const { devices, selectedId, permission, error, requestAndEnumerate, selectDevice } =
    useAudioDevices();

  // 패널 진입 시 권한 요청 + 장치 열거 (미리 선택 가능하게)
  useEffect(() => {
    requestAndEnumerate();
  }, [requestAndEnumerate]);

  const isLive = ingestState === 'live';
  const isPending = ingestState === 'connecting' ||
    ingestState === 'authenticating' ||
    ingestState === 'reconnecting';
  const isActive = isLive || isPending;

  const deviceError = error ?? audioError;

  return (
    <div className="panel rail-live">
      <div className="panel-head">
        <span className="eyebrow">LIVE</span>
        <h2>라이브 방송</h2>
        <div className="spacer" />
        <span className={`pill ${isLive ? 'on-air' : isPending ? 'warn' : ''}`}>
          {STATE_LABEL[ingestState]}{ingestDetail ? ` · ${ingestDetail}` : ''}
        </span>
      </div>

      {permission === 'denied' && (
        <div className="banner error">
          마이크 권한이 거부되었습니다. 주소창의 자물쇠 아이콘에서 마이크를 허용해 주세요.
        </div>
      )}
      {deviceError && permission !== 'denied' && (
        <div className="banner error">{deviceError.message}</div>
      )}

      <div className="field-row">
        <label htmlFor="mic">마이크</label>
        <select
          id="mic"
          value={selectedId ?? ''}
          disabled={isActive || devices.length === 0}
          onChange={(e) => selectDevice(e.target.value)}
        >
          {devices.length === 0 && <option value="">마이크를 찾는 중…</option>}
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
          ))}
        </select>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={recordFlash}
          disabled={isActive}
          onChange={(e) => onRecordFlashChange(e.target.checked)}
        />
        <span>단말에 녹음(재방송 저장)</span>
      </label>

      {!isActive ? (
        <button
          className="onair-btn"
          disabled={!selectedId}
          onClick={() => selectedId && onStart(selectedId)}
          title={selectedCount > 0
            ? `선택한 ${selectedCount}대에 방송`
            : '연결된 전체 단말에 방송'}
        >
          <span className="dot" />
          방송 시작
        </button>
      ) : (
        <button
          className={`onair-btn ${isLive ? 'live' : 'pending'}`}
          onClick={onStop}
        >
          <span className="dot" />
          {isLive ? 'ON AIR · 누르면 중지' : '연결 중… 누르면 취소'}
        </button>
      )}
    </div>
  );
}