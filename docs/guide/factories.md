# DomainState 팩토리 메서드 🏭

`DomainState` 인스턴스는 직접 `new` 키워드로 생성하지 않고, 상황에 맞는 **팩토리 메서드**를 통해 생성합니다. 각 팩토리는 데이터의 출처에 따라 `isNew` 플래그를 자동으로 설정합니다.

## 1. fromJSON (조회 데이터 바인딩)

서버에서 GET 요청으로 받아온 JSON 응답을 기반으로 상태를 생성합니다.
* **isNew:** `false` (저장 시 PATCH 또는 PUT으로 분기)

```javascript
// 기본 사용법
const user = DomainState.fromJSON(jsonText, api);

// 옵션을 활용한 고급 사용법
const user = DomainState.fromJSON(jsonText, api, {
  vo: new UserVO(),      // 1. 스키마 검증 및 기본값/변환기 주입
  form: 'user-form',     // 2. 응답 데이터를 HTML 폼에 즉시 채워넣음 (역동기화)
  label: 'User Data'     // 3. 디버그 팝업용 레이블 지정
});
```

## 2. fromForm (HTML 폼 바인딩)

HTML 폼 요소의 현재 값을 읽어 초기 상태를 만들고, 이후 발생하는 `blur`, `change` 이벤트를 Proxy에 자동 바인딩합니다.
* **isNew:** `true` (저장 시 POST로 분기)

```javascript
// form id 또는 HTMLFormElement 직접 전달
const formState = DomainState.fromForm('user-form', api);
```

> **💡 이벤트 추적 최적화:** `input[type=text]`나 `textarea`는 사용자가 타이핑하는 동안 과도한 Proxy 트랩이 발생하는 것을 막기 위해 `blur` 시점에만 동기화됩니다. 반면 `select`, `radio`, `checkbox`는 값이 즉시 확정되므로 `change` 시점에 동기화됩니다.

## 3. fromVO (스키마 기반 신규 생성)

`DomainVO` 클래스에 정의된 `default` 필드들을 기반으로 빈 뼈대(Skeleton) 객체를 만들어 상태를 초기화합니다.
* **isNew:** `true` (저장 시 POST로 분기)

```javascript
const newUser = DomainState.fromVO(new UserVO(), api, { debug: true });
```