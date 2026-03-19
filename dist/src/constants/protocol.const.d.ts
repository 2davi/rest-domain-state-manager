/**
 * PROTOCOL : 지원하는 URL 프로토콜 상수
 */
export type PROTOCOL = string;
/**
 * @fileoverview URL 프로토콜 및 실행 환경 상수
 *
 * URL 조합 시 프로토콜 결정 우선순위:
 *   1. 명시적 protocol 인자
 *   2. env 플래그 → DEFAULT_PROTOCOL[env]
 *   3. env 없음 + debug: true  → HTTP  (개발 환경으로 판단)
 *   4. env 없음 + debug: false → HTTPS (프로덕션으로 판단)
 *
 * @module constants/protocol.const
 */
/**
 * PROTOCOL : 지원하는 URL 프로토콜 상수
 * @readonly
 * @enum {string}
 */
export const PROTOCOL: Readonly<{
    HTTP: "http://";
    HTTPS: "https://";
    FILE: "file:///";
    SSH: "ssh://";
}>;
/**
 * ENV : 실행 환경 식별자 상수
 */
export type ENV = string;
/**
 * ENV : 실행 환경 식별자 상수
 * @readonly
 * @enum {string}
 */
export const ENV: Readonly<{
    DEVELOPMENT: "development";
    PRODUCTION: "production";
}>;
/**
 * DEFAULT_PROTOCOL : 환경별 기본 프로토콜 매핑
 * @readonly
 * @type {Readonly<Record<string, string>>}
 */
export const DEFAULT_PROTOCOL: Readonly<Record<string, string>>;
/**
 * VALID_PROTOCOL_KEYS : 유효한 프로토콜 키 목록 (사용자 입력 검증용)
 * @readonly
 * @type {ReadonlyArray<string>}
 */
export const VALID_PROTOCOL_KEYS: ReadonlyArray<string>;
