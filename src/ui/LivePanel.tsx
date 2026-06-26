import { useEffect } from 'react';
import { useAudioDevices } from '../audio/useAudioDevices';
import { ClassifiedAudioError } from '../audio/audioErrors';
import { IngestState } from '../net/ingestClient';

interface Props {
  ingestState: IngestState;
  ingestDetail: string | null;
  audioError: ClassifiedAudioError | null;
  onStart: (deviceId: string) => void;
  onStop: () => void;
}

const STATE_LABEL: Record<IngestState, string> = {
  idle: '대기 중',
  connecting: '연결 중…',
  authenticating: '인증 중…',
  live: '방송 중',
  reconnecting: '재연결 중…',
  rejected: '거부됨',
  closed: '종료됨',
};

export function LivePanel({ ingestState, ingestDetail, audioError, onStart, onStop }: Props) {
  const { devices, selectedId, permission, error, requestAndEnumerate, selectDevice } =
    useAudioDevices();

  // 패널 진입 시 권한 요청 + 장치 열거
  useEffect(() => {
    requestAndEnumerate();
  }, [requestAndEnumerate]);

  const isLive = ingestState === 'live' ||
    ingestState === 'connecting' ||
    ingestState === 'authenticating' ||
    ingestState === 'reconnecting';

  const deviceError = error ?? audioError;

  return (
    <div className="card">
      <h2>
        라이브 방송
        <span className={`tag ${isLive ? 'live' : ''}`}>
          {STATE_LABEL[ingestState]}{ingestDetail ? ` · ${ingestDetail}` : ''}
        </span>
      </h2>

      {permission === 'denied' && (
        <div className="banner error">
          마이크 권한이 거부되었습니다. 주소창의 자물쇠 아이콘에서 마이크를 허용해 주세요.
        </div>
      )}
      {deviceError && permission !== 'denied' && (
        <div className="banner error">{deviceError.message}</div>
      )}

      <div className="row">
        <label htmlFor="mic">마이크</label>
        <select
          id="mic"
          value={selectedId ?? ''}
          disabled={isLive || devices.length === 0}
          onChange={(e) => selectDevice(e.target.value)}
        >
          {devices.length === 0 && <option value="">마이크를 찾는 중…</option>}
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
          ))}
        </select>
      </div>

      {!isLive ? (
        <button
          className="btn-live"
          disabled={!selectedId}
          onClick={() => selectedId && onStart(selectedId)}
        >
          방송 시작
        </button>
      ) : (
        <button className="btn-live on" onClick={onStop}>
          방송 중지
        </button>
      )}
    </div>
  );
}
