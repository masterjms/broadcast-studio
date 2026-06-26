/**
 * oggOpus.ts — Ogg Opus 스트림 → raw Opus packet 디먹서.
 *
 * opus-recorder는 Ogg 컨테이너로 감싼 Opus를 출력한다. 하지만 서버는
 * 컨테이너 없는 raw Opus packet을 요구한다(WSS binary 1개 = packet 1개,
 * OggS/OpusHead/OpusTags 금지). 그래서 Ogg 페이지를 풀어 audio packet만
 * 추출한다. 서버 opus_source.iter_ogg_opus_packets와 동일한 알고리즘이되,
 * 스트리밍 입력을 위해 상태를 유지하는 디먹서로 구현했다.
 *
 * Ogg page 구조:
 *   "OggS"(4) ver(1) htype(1) granule(8) serial(4) seq(4) crc(4)
 *   nsegs(1) segment_table(nsegs) body(...)
 * packet은 segment를 이어붙이되 길이 255 미만 segment에서 끝난다.
 * 255 segment는 다음 segment(또는 다음 page)로 packet이 이어진다.
 */

const HEADER_MIN = 27; // OggS 헤더 고정 길이

function startsWith(buf: Uint8Array, sig: string): boolean {
  if (buf.length < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[i] !== sig.charCodeAt(i)) return false;
  }
  return true;
}

export class OggOpusDemuxer {
  private buf = new Uint8Array(0);
  private carry: Uint8Array[] = []; // page 경계를 넘어 이어지는 packet 조각

  /** Ogg 바이트 청크를 입력하고, 완성된 raw audio packet 목록을 반환한다. */
  feed(chunk: Uint8Array): Uint8Array[] {
    // 누적 버퍼에 이어 붙이기
    const merged = new Uint8Array(this.buf.length + chunk.length);
    merged.set(this.buf, 0);
    merged.set(chunk, this.buf.length);
    this.buf = merged;

    const out: Uint8Array[] = [];
    let pos = 0;

    while (true) {
      // 다음 OggS 페이지 헤더가 통째로 들어왔는지 확인
      if (this.buf.length - pos < HEADER_MIN) break;
      if (!startsWith(this.buf.subarray(pos), 'OggS')) {
        // 동기 깨짐 → 다음 OggS 탐색
        const next = this.indexOf(this.buf, 'OggS', pos + 1);
        if (next < 0) {
          pos = this.buf.length; // 버릴 수 있는 만큼 버림
          break;
        }
        pos = next;
        continue;
      }

      const nsegs = this.buf[pos + 26];
      const tableEnd = pos + 27 + nsegs;
      if (this.buf.length < tableEnd) break; // 세그먼트 테이블 미완성

      const segTable = this.buf.subarray(pos + 27, tableEnd);
      const bodyLen = segTable.reduce((a, b) => a + b, 0);
      const bodyEnd = tableEnd + bodyLen;
      if (this.buf.length < bodyEnd) break; // 본문 미완성 → 더 기다림

      // 페이지 본문을 lacing 규칙으로 packet 분해
      let idx = tableEnd;
      let cur: Uint8Array[] = this.carry;
      this.carry = [];
      for (let s = 0; s < segTable.length; s++) {
        const segLen = segTable[s];
        cur.push(this.buf.subarray(idx, idx + segLen));
        idx += segLen;
        if (segLen < 255) {
          const packet = this.concat(cur);
          cur = [];
          if (!startsWith(packet, 'OpusHead') && !startsWith(packet, 'OpusTags')) {
            out.push(packet);
          }
        }
      }
      this.carry = cur; // 255로 끝난 미완성 packet은 다음 page로 이월

      pos = bodyEnd;
    }

    // 소비한 부분 제거
    this.buf = this.buf.subarray(pos);
    return out;
  }

  private indexOf(buf: Uint8Array, sig: string, from: number): number {
    for (let i = from; i <= buf.length - sig.length; i++) {
      let ok = true;
      for (let j = 0; j < sig.length; j++) {
        if (buf[i + j] !== sig.charCodeAt(j)) { ok = false; break; }
      }
      if (ok) return i;
    }
    return -1;
  }

  private concat(parts: Uint8Array[]): Uint8Array {
    let len = 0;
    for (const p of parts) len += p.length;
    const out = new Uint8Array(len);
    let off = 0;
    for (const p of parts) { out.set(p, off); off += p.length; }
    return out;
  }
}