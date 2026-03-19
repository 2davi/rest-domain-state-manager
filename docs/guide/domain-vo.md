# DomainVO 스키마 및 유효성 검사

`DomainVO`는 도메인의 구조를 선언하는 베이스 클래스입니다. `DomainState.fromVO()` 또는 `fromJSON()`의 인자로 전달되어 뼈대 제공, 유효성 검사, 타입 변환의 세 가지 역할을 수행합니다.

## 필드 스키마 (fields) 선언

각 필드는 `default`, `validate`, `transform` 속성을 가질 수 있습니다.

```javascript
class ProductVO extends DomainVO {
  // save() 시 경로를 생략하면 이 URL로 자동 전송됩니다.
  static baseURL = 'localhost:8080/api/products';

  static fields = {
    productId: { 
      default: '' 
    },
    name: {
      default: '',
      validate: (v) => v.trim().length > 0   // 빈 문자열 거부
    },
    price: {
      default: 0,
      validate: (v) => v >= 0,               // 음수 거부
      transform: Number                      // 직렬화 직전에 무조건 숫자로 변환
    },
    tags: {
      default: []                            // 배열 및 중첩 객체도 선언 가능
    }
  };
}
```

## 제공되는 핵심 기능

1. **기본값 골격 (Skeleton):** `fromVO()` 호출 시 `fields.default` 값을 깊은 복사(Deep Copy)하여 초기 객체를 구성합니다.
2. **유효성 검사 (Validator):** `save()` 메서드가 호출되면 통신 직전에 각 필드의 `validate` 함수를 실행합니다.
3. **타입 변환 (Transformer):** `save()` 직렬화 직전에 `transform` 함수를 실행하여 문자열로 입력된 숫자 등을 올바른 타입으로 교정합니다.

## 스키마 검증 (checkSchema)

서버에서 내려준 데이터가 내가 정의한 프론트엔드 VO 스키마와 일치하는지 확인할 수 있습니다.
`fromJSON()` 옵션에 `vo`를 넘기면 불일치 시 콘솔에 경고(Warning)를 출력해 주어 API 스펙 변경을 조기에 감지할 수 있습니다.

```javascript
const product = DomainState.fromJSON(jsonText, api, { vo: new ProductVO() });
// 누락된 키(missingKeys)나 잉여 키(extraKeys)가 있다면 콘솔에 경고 발생
```