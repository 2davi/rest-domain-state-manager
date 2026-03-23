# DomainVO 스키마

<span class="badge badge-stable">Stable</span>

`DomainVO` 는 도메인 객체의 구조를 선언하는 추상 베이스 클래스입니다. `DomainState.fromVO()` 또는 `fromJSON()` 에 전달되어 세 가지 역할을 수행합니다.

1. **뼈대 제공 (Skeleton)** — `fields.default` 값으로 초기 객체 구조를 생성합니다.
2. **유효성 검사 (Validation)** — `save()` 호출 전에 각 필드의 `validate` 함수를 실행합니다.
3. **타입 변환 (Transformation)** — 직렬화 직전에 `transform` 함수를 실행하여 데이터 타입을 교정합니다.

## 필드 스키마 선언

`DomainVO` 를 상속한 클래스에 `static fields` 객체를 선언합니다. 각 키가 도메인 필드이고, 값은 그 필드의 동작을 정의하는 설정 객체입니다.

```javascript
import { DomainVO } from '@2davi/rest-domain-state-manager'

class ProductVO extends DomainVO {
    // save() 경로를 생략하면 이 URL로 자동 전송됩니다 (선택적)
    static baseURL = 'localhost:8080/api/products'

    static fields = {
        productId: {
            default: ''
        },
        name: {
            default:  '',
            validate: (v) => v.trim().length > 0   // 빈 문자열 거부
        },
        price: {
            default:   0,
            validate:  (v) => v >= 0,              // 음수 거부
            transform: Number                      // 문자열 입력을 숫자로 변환
        },
        stock: {
            default:   0,
            validate:  (v) => Number.isInteger(v) && v >= 0,
            transform: (v) => Math.floor(Number(v))
        },
        tags: {
            default: []                            // 배열과 중첩 객체도 선언 가능
        },
        metadata: {
            default: { createdBy: '', category: 'general' }
        }
    }
}
```

<table class="param-table">
  <thead>
    <tr><th>필드 속성</th><th>타입</th><th>설명</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><code>default</code></td>
      <td><code>any</code></td>
      <td><strong>필수.</strong> 이 필드의 초기값. <code>fromVO()</code> 호출 시 깊은 복사(Deep Clone)되어 Skeleton 객체를 구성합니다.</td>
    </tr>
    <tr>
      <td><code>validate</code></td>
      <td><code>(value) => boolean</code></td>
      <td>유효성 검사 함수. <code>false</code>를 반환하면 <code>save()</code>가 중단됩니다.</td>
    </tr>
    <tr>
      <td><code>transform</code></td>
      <td><code>(value) => any</code></td>
      <td>직렬화 직전 타입 변환 함수. 예: <code>Number</code>, <code>String</code>, 커스텀 함수.</td>
    </tr>
  </tbody>
</table>

## 스키마 검증 (checkSchema)

`fromJSON()` 에 `vo` 옵션을 전달하면 서버 응답 데이터와 VO 스키마를 비교하여 불일치를 경고합니다. API 스펙 변경을 개발 시점에 조기 감지하는 데 유용합니다.

```javascript
const product = DomainState.fromJSON(jsonText, api, { vo: new ProductVO() })
```

서버 응답에 VO에 없는 키가 포함되어 있거나(`extraKeys`), VO에 선언된 키가 응답에 없는 경우(`missingKeys`) 콘솔에 경고를 출력합니다. 어느 경우든 인스턴스 생성은 계속 진행됩니다.

## V8 Hidden Class 최적화와 DomainVO

`DomainVO` 는 단순한 유효성 검사 도구 이상의 역할을 합니다. 모든 필드를 사전에 선언함으로써 V8 엔진이 객체의 **Hidden Class** 를 고정할 수 있게 합니다.

V8은 동일한 프로퍼티 구조를 가진 객체들에 대해 메모리 오프셋을 캐싱하여 접근 속도를 O(1)에 가깝게 최적화합니다. `DomainVO` 없이 서버 응답을 직접 파싱하면 각 응답마다 프로퍼티 구조가 달라져 이 최적화가 깨질 수 있습니다. `DomainVO` 로 뼈대를 선언하면 모든 인스턴스가 동일한 Hidden Class를 공유하여 JIT 컴파일러 최적화 효과를 극대화합니다.

자세한 내용은 [V8 최적화 전략](/architecture/v8-optimization) 을 참고하세요.
