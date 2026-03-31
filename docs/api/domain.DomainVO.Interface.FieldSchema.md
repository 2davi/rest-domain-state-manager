# Interface: FieldSchema

## Properties

### default?

> `optional` **default?**: `any`

필드의 기본값. `toSkeleton()`이 초기 객체를 생성할 때 사용한다.
  `object` 또는 `array`이면 `safeClone(val)`로 deep copy하여
  인스턴스 간 참조 공유를 방지한다.
  `structuredClone()`을 우선 사용하고, 미지원 환경에서는 재귀 폴백으로 처리한다.
  `Date`·`RegExp` 등 특수 타입의 타입 손실을 방지한다.

***

### transform?

> `optional` **transform?**: (`value`) => `any`

타입 변환 함수. `toPayload()` 직렬화 전에 실행되어 값을 변환한다.
  `DomainState._transformers`에 주입된다.
  예: `Number` (문자열 입력을 숫자로 변환), `v => v.trim()` (공백 제거)

#### Parameters

##### value

`any`

#### Returns

`any`

***

### validate?

> `optional` **validate?**: (`value`) => `boolean`

필드 유효성 검사 함수. 반환값이 `false`이면 유효하지 않은 값으로 간주한다.
  `DomainState._validators`에 주입되어 `save()` 직전에 실행될 예정이다.
  예: `v => v.trim().length > 0`, `v => v >= 0`

#### Parameters

##### value

`any`

#### Returns

`boolean`
