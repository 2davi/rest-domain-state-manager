# Function: safeClone()

> **safeClone**(`value`): `any`

값을 깊게 복사한다.

`structuredClone()`이 지원되는 환경(Chrome 98+, Firefox 94+, Safari 15.4+, Node.js 17+)에서는
V8 C++ 네이티브 직렬화 파이프라인을 사용한다.
미지원 환경(구형 Android WebView, 일부 공공기관 내부망 키오스크 등)에서는
`_cloneDeep()`으로 폴백하여 점진적 향상(Progressive Enhancement)을 제공한다.

## `structuredClone` vs `JSON.parse(JSON.stringify())` 비교

| 타입                | `JSON.parse` 방식          | `safeClone`                |
|---------------------|----------------------------|----------------------------|
| `Date`              | ISO 문자열로 손실           | ✅ `Date` 객체로 보존       |
| `undefined` 프로퍼티 | 키 자체 소멸               | ✅ 그대로 보존              |
| `RegExp`            | 빈 `{}` 객체로 손실         | ✅ `RegExp`으로 보존        |
| `Map`, `Set`        | 빈 `{}`/`[]`로 파괴         | ✅ 완전 보존 (SC 경로)      |
| 순환 참조           | 런타임 에러                 | ✅ 올바르게 처리 (SC 경로)  |

## `_cloneDeep` 폴백의 한계
`Map`·`Set`은 현 VO 레이어에서 `default` 값으로 사용되지 않으므로
폴백에서 특수 처리를 생략하였다. 레거시 환경에서 `Map`·`Set` 기본값이 필요하다면
`structuredClone` 폴리필(`@ungap/structured-clone` 등) 도입을 검토하라.

## Parameters

### value

`any`

복사할 값

## Returns

`any`

깊은 복사된 값

## Examples

```ts
const obj = { createdAt: new Date('2026-01-01') };
const copy = safeClone(obj);
console.log(copy.createdAt instanceof Date); // true (JSON 방식은 string으로 변환됨)
copy.createdAt.setFullYear(2025);
console.log(obj.createdAt.getFullYear());    // 2026 — 원본 불변
```

```ts
// 인스턴스마다 독립적인 address 참조를 갖도록 보장
const skeleton = new UserVO().toSkeleton();
skeleton.address.city = 'Busan';
console.log(new UserVO().toSkeleton().address.city); // '' — 오염 없음
```
