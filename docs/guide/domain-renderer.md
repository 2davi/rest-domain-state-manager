# DomainRenderer 플러그인

<span class="badge badge-stable">Stable</span>

`DomainRenderer` 는 목록형 API 응답(배열 데이터)을 HTML UI 요소로 렌더링하는 플러그인입니다. `select`, `radio`, `checkbox`, `button` 그룹을 반복적으로 수동 생성하는 코드를 대체합니다.

## 등록

```javascript
import { DomainState, DomainRenderer } from '@2davi/rest-domain-state-manager'

DomainState.use(DomainRenderer)
```

등록 후 배열 데이터를 가진 `DomainState` 인스턴스에 `renderTo(target, config)` 메서드가 추가됩니다.

::: warning 배열 데이터 전용
`renderTo()` 는 루트 데이터가 **배열**인 인스턴스에서만 동작합니다. 단일 객체 데이터에서 호출하면 오류가 발생합니다.
:::

## renderTo — 기본 사용법

```javascript
// 배열 응답 조회
const roles = await api.get('/roles')
// data: [{ roleId: 'R01', roleName: '관리자' }, { roleId: 'R02', ... }]

// select 드롭다운 렌더링
roles.renderTo('#roleSelect', {
    type:        'select',
    valueField:  'roleId',    // <option value="...">
    labelField:  'roleName',  // <option>텍스트</option>
    placeholder: '역할을 선택하세요',
    class:       'form-select',
})
```

## 공통 옵션

모든 `type` 에 공통으로 적용되는 옵션입니다.

<table class="param-table">
  <thead>
    <tr><th>옵션</th><th>타입</th><th>설명</th></tr>
  </thead>
  <tbody>
    <tr><td><code>type</code></td><td><code>'select' | 'radio' | 'checkbox' | 'button'</code></td><td><strong>필수.</strong> 생성할 UI 요소 유형.</td></tr>
    <tr><td><code>valueField</code></td><td><code>string</code></td><td><strong>필수.</strong> 데이터에서 <code>value</code>로 사용할 필드명.</td></tr>
    <tr><td><code>labelField</code></td><td><code>string</code></td><td><strong>필수.</strong> 화면에 표시할 텍스트 필드명.</td></tr>
    <tr><td><code>class</code></td><td><code>string</code></td><td>생성될 요소에 부여할 CSS 클래스명.</td></tr>
    <tr><td><code>css</code></td><td><code>object</code></td><td>요소에 직접 주입할 인라인 스타일. camelCase 표기.</td></tr>
    <tr><td><code>events</code></td><td><code>object</code></td><td>이벤트 핸들러 맵. <code>{ click: (e) => {...}, change: ... }</code> 형식.</td></tr>
  </tbody>
</table>

## Select

```javascript
roles.renderTo('#roleSelect', {
    type:        'select',
    valueField:  'roleId',
    labelField:  'roleName',
    placeholder: '역할을 선택하세요',  // 비활성 기본 옵션 생성
    multiple:    false,
    class:       'form-select',
})
```

## Radio / Checkbox

`name` 옵션을 생략하면 `valueField` 값이 `input[name]` 속성으로 자동 할당됩니다. 이는 MyBatis 기반 서버의 폼 파라미터 매핑 패턴에 최적화된 설계입니다.

```javascript
roles.renderTo('#roleRadio', {
    type:           'radio',
    valueField:     'roleId',        // input[name="roleId"] 로 자동 설정
    labelField:     'roleName',
    containerClass: 'form-check',    // 각 항목을 감싸는 div의 클래스
    class:          'form-check-input',
    labelClass:     'form-check-label',
})
```

## Button

각 버튼의 데이터 값은 `button[data-value]` 속성으로 주입됩니다.

```javascript
roles.renderTo('#roleBtns', {
    type:       'button',
    valueField: 'roleId',
    labelField: 'roleName',
    class:      'btn btn-outline-primary',
    events: {
        click: (e) => {
            const selectedRole = e.target.dataset.value
            console.log('선택된 역할:', selectedRole)
        }
    }
})
```

## 인터랙티브 시연

<PlaygroundRenderer />

## 인터랙티브 시연

배열 데이터가 `select` 와 `radio` 로 각각 어떻게 렌더링되는지 직접 확인해보세요. 타입을 전환하면 동일한 데이터가 다른 UI 요소로 즉시 재렌더링됩니다.

<PlaygroundRenderer />
