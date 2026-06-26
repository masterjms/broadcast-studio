/**
 * audioErrors.ts — 오디오 캡처 실패 원인 분류.
 *
 * 예전 FFmpeg dshow 환경에서 "장치를 못 잡는데 이유를 모르는" 문제가
 * 반복됐다. 브라우저 getUserMedia는 실패 원인을 명확한 에러 이름으로
 * 알려준다. 이를 사용자가 바로 행동할 수 있는 메시지로 변환한다.
 */

export type AudioErrorKind =
  | 'insecure_context'   // HTTPS가 아니라 마이크 접근 불가
  | 'permission_denied'  // 사용자가 권한 거부
  | 'no_device'          // 입력 장치 없음
  | 'device_busy'        // 다른 앱이 장치 점유 중
  | 'overconstrained'    // 요청한 조건(샘플레이트 등)을 장치가 못 맞춤
  | 'not_supported'      // 브라우저가 API 미지원
  | 'unknown';

export interface ClassifiedAudioError {
  kind: AudioErrorKind;
  message: string;       // 사용자에게 보여줄 한국어 안내
  recoverable: boolean;  // 재시도로 해결 가능한지
}

export function classifyAudioError(err: unknown): ClassifiedAudioError {
  // 보안 컨텍스트(HTTPS/localhost)가 아니면 getUserMedia 자체가 없음
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return {
      kind: 'insecure_context',
      message: 'HTTPS 연결에서만 마이크를 사용할 수 있습니다. https 주소로 접속해 주세요.',
      recoverable: false,
    };
  }

  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    return {
      kind: 'not_supported',
      message: '이 브라우저는 마이크 입력을 지원하지 않습니다. 최신 Chrome/Edge를 사용해 주세요.',
      recoverable: false,
    };
  }

  const name = (err as DOMException)?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        kind: 'permission_denied',
        message:
          '마이크 권한이 거부되었습니다. 주소창의 자물쇠 아이콘에서 마이크를 "허용"으로 바꾼 뒤 다시 시도해 주세요.',
        recoverable: true,
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        kind: 'no_device',
        message:
          '연결된 마이크를 찾을 수 없습니다. 마이크가 PC에 꽂혀 있는지 확인해 주세요.',
        recoverable: true,
      };
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        kind: 'device_busy',
        message:
          '다른 프로그램이 마이크를 사용 중입니다. 줌·녹음기 등 마이크를 쓰는 앱을 닫고 다시 시도해 주세요.',
        recoverable: true,
      };
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return {
        kind: 'overconstrained',
        message:
          '선택한 마이크가 요청한 오디오 형식을 지원하지 않습니다. 다른 마이크를 선택해 주세요.',
        recoverable: true,
      };
    default:
      return {
        kind: 'unknown',
        message: `마이크를 여는 중 알 수 없는 오류가 발생했습니다. (${name || 'Error'})`,
        recoverable: true,
      };
  }
}