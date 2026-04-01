# Function: deepFreeze()

```ts
function deepFreeze<T>(obj, seen?): T;
```

객체와 모든 중첩 객체를 재귀적으로 동결한다.

`WeakSet`으로 순환 참조를 방어한다. 이미 방문한 객체는 재순회하지 않는다.
`null`과 Primitive 값은 즉시 반환한다.

## Type Parameters

### T

`T`

## Parameters

### obj

`T`

동결할 값

### seen?

`WeakSet`\<`object`\> = `...`

순환 참조 방어용 방문 집합 (재귀 호출 시 전달)

## Returns

`T`

동결된 값 (원본 참조 반환)
