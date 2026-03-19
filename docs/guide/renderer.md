# DomainRenderer UI 렌더링 옵션

`DomainRenderer` 플러그인을 주입하면, 배열 형태의 데이터를 가진 `DomainState` 인스턴스에서 `renderTo(selector, config)` 메서드를 사용할 수 있습니다.

> **⚠️ 주의:** 단일 객체가 아닌 **배열 데이터**(예: 목록 API 응답)를 보유하고 있을 때만 동작합니다.

## 1. 공통 옵션 (모든 type 공통)

어떤 렌더링 타입을 선택하든 기본적으로 사용하는 속성입니다.

| 옵션 | 타입 | 설명 |
|---|---|---|
| `type` | string | `'select'`, `'radio'`, `'checkbox'`, `'button'` 중 택 1 |
| `valueField` | string | 데이터에서 `value` 속성으로 쓸 필드명 |
| `labelField` | string | 데이터에서 화면에 보여줄 텍스트 필드명 |
| `class` | string | 생성될 HTML 요소에 부여할 `className` |
| `css` | object | 요소에 직접 주입할 인라인 스타일 (camelCase 표기) |
| `events` | object | `{ click: (e) => {...}, change: ... }` 형태의 이벤트 핸들러 맵 |

## 2. 타입별 전용 옵션 및 예제

### Select (드롭다운)

첫 번째 항목으로 안내 문구를 넣는 `placeholder`와 다중 선택을 위한 `multiple` 옵션이 추가됩니다.

```javascript
roles.renderTo('#roleSelect', {
  type: 'select',
  valueField: 'roleId',
  labelField: 'roleName',
  placeholder: '역할을 선택하세요', // 비활성 기본 옵션 생성
  multiple: false
});
```

### Radio / Checkbox

라디오 버튼과 체크박스는 컨테이너 `div`와 텍스트용 `label` 요소가 함께 생성되므로 클래스 설정이 세분화됩니다.

* **`name` 옵션의 마법:** 명시하지 않으면 `valueField` 값이 `name` 속성으로 자동 할당됩니다. 이는 서버 측 MyBatis 자동 폼 매핑 패턴에 최적화된 설계입니다.

```javascript
roles.renderTo('#roleRadio', {
  type: 'radio',
  valueField: 'roleId',        // input[name="roleId"] 로 자동 설정됨!
  labelField: 'roleName',
  containerClass: 'form-check',
  class: 'form-check-input',
  labelClass: 'form-check-label'
});
```

### Button

버튼 그룹 렌더링 시, `valueField` 값은 `<button data-value="...">` 형태의 `dataset`으로 주입됩니다. 클릭 이벤트에서 이 값을 쉽게 읽어올 수 있습니다.

```javascript
roles.renderTo('#roleBtns', {
  type: 'button',
  valueField: 'roleId',
  labelField: 'roleName',
  class: 'btn btn-outline-primary',
  events: {
    // dataset.value를 통해 클릭된 버튼의 값을 획득
    click: (e) => console.log('선택됨:', e.target.dataset.value)
  }
});
```