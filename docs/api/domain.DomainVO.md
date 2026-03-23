# domain/DomainVO

DomainVO — 신규 INSERT 도메인 구조 선언 베이스 클래스

`DomainState.fromVO()`의 인자로 사용하며,
`static fields`를 통해 **기본값 골격**, **필드 유효성 검사**, **타입 변환**을 선언한다.

## 역할

| 메서드            | 제공 기능               | `DomainState`에서 사용 시점                          |
|-----------------|------------------------|------------------------------------------------------|
| `toSkeleton()`  | 기본값 골격 객체 생성    | `fromVO()` — `createProxy()` 입력 객체로 사용         |
| `getValidators()`| 필드별 검증 함수 맵 반환 | `fromVO()` — `DomainState._validators`에 주입         |
| `getTransformers()`| 필드별 변환 함수 맵 반환| `fromVO()` — `DomainState._transformers`에 주입       |
| `getBaseURL()`  | `static baseURL` 반환  | `fromVO()` — `urlConfig` 폴백으로 사용                |
| `checkSchema()` | 응답 데이터 스키마 검증  | `fromJSON()` — `vo` 옵션과 함께 스키마 일치 여부 검사  |

## 서브클래스 선언 예시

```js
class UserVO extends DomainVO {
    static baseURL = 'localhost:8080/api/users';

    static fields = {
        userId:  { default: '' },
        name:    { default: '', validate: v => v.trim().length > 0 },
        age:     { default: 0,  validate: v => v >= 0, transform: Number },
        address: { default: { city: '', zip: '' } },
    };
}

const newUser = DomainState.fromVO(new UserVO(), api, { debug: true });
newUser.data.userId = 'user_' + Date.now();
newUser.data.name   = 'Davi';
await newUser.save(); // → POST to static baseURL
```

## `static fields` 미선언 시
`static fields`가 없으면 `toSkeleton()`은 인스턴스의 own property를 그대로 반환한다.
이 경우 `getValidators()` / `getTransformers()` / `checkSchema()`는 빈 결과를 반환한다.

## See

DomainState

## Classes

- [DomainVO](domain.DomainVO.Class.DomainVO.md)

## Interfaces

- [FieldSchema](domain.DomainVO.Interface.FieldSchema.md)
- [SchemaCheckResult](domain.DomainVO.Interface.SchemaCheckResult.md)

## Type Aliases

- [FieldsSchema](domain.DomainVO.TypeAlias.FieldsSchema.md)
- [TransformerMap](domain.DomainVO.TypeAlias.TransformerMap.md)
- [ValidatorMap](domain.DomainVO.TypeAlias.ValidatorMap.md)
