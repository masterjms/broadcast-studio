# 군포 방송 스튜디오 (gunpo-broadcaster)

iotradio 서버의 웹 프론트엔드. Vite + React + TypeScript.

## 개발
```
npm install
npm run dev        # https://iotradio.co.kr 로 API/WSS 프록시
```
다른 서버로 개발하려면: `VITE_SERVER=https://내서버 npm run dev`

백엔드 없이 내부 UI만 확인하려면:
```
VITE_DEV_BYPASS_LOGIN=true npm run dev
```
이 모드는 Vite 개발 서버에서만 동작하며, 로그인/상태/파일 목록을 샘플 데이터로 대체한다.

## 빌드 & 배포
```
npm run build      # dist/ 생성 (encoderWorker.min.js 자동 복사 포함)
```
`dist/`의 내용을 서버의 `/opt/iotradio/web/` 에 올리면 nginx가 `/` 에서 서빙한다.

## 마이크 오디오 처리
- opus-recorder로 마이크 캡처 + Opus 인코딩(16kHz mono, 40ms)
- Ogg 페이지에서 raw Opus packet 추출(oggOpus.ts) → 서버 사양에 맞춤
- 장치는 deviceId로 선택(useAudioDevices) → 이름 기반 장치 인식 문제 회피
