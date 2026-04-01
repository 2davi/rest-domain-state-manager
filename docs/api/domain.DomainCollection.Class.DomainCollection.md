# Class: DomainCollection

`saveAll()` 메서드의 `options` 파라미터.

## Constructors

### Constructor

```ts
new DomainCollection(
   handler, 
   options?, 
   isNew?): DomainCollection;
```

`DomainCollection` 인스턴스를 생성한다.

**직접 호출 금지.** `create()` / `fromJSONArray()` 팩토리 메서드를 사용한다.

#### Parameters

##### handler

[`ApiHandler`](network.api-handler.Class.ApiHandler.md)

HTTP 전송 레이어. `saveAll()` 호출에 필수.

##### options?

[`DomainCollectionOptions`](domain.DomainCollection.Interface.DomainCollectionOptions.md) = `{}`

컬렉션 옵션.

##### isNew?

`boolean` = `true`

`true`이면 `saveAll()` 시 POST, `false`이면 PUT.

#### Returns

`DomainCollection`

## Properties

### \_debug

```ts
_debug: boolean;
```

디버그 플래그. `add()` / `fromJSONArray()`로 생성되는 각 DomainState에 전파된다.

***

### \_handler

```ts
_handler: ApiHandler;
```

HTTP 전송 레이어. `saveAll()` 내부에서 직접 호출된다.

***

### \_initialSnapshot

```ts
_initialSnapshot: object[] | null;
```

`fromJSONArray()` 호출 시점의 초기 배열 스냅샷.
`lazy` 모드에서 `saveAll()` 시 diff 기준점으로 사용된다.
`create()` 로 생성된 경우 `null`.
`saveAll()` 성공 후 현재 상태로 갱신된다.

***

### \_isNew

```ts
_isNew: boolean;
```

`isNew: true`이면 `saveAll()` 시 POST, `false`이면 PUT.
`create()`로 생성하면 `true`, `fromJSONArray()`로 생성하면 `false`.
`saveAll()` 성공 후 `false`로 전환된다.

***

### \_itemKey

```ts
_itemKey: string | undefined;
```

`lazy` 모드에서 배열 항목 동일성 기준 필드명.
`UILayout.static itemKey`가 v1.4.x에서 이 값을 덮어쓴다.

***

### \_items

```ts
_items: DomainState[];
```

내부 `DomainState` 인스턴스 배열.
`getItems()` / `add()` / `remove()` 를 통해서만 관리한다.

***

### \_trackingMode

```ts
_trackingMode: "realtime" | "lazy";
```

변경 추적 모드. 각 DomainState 항목에 전파된다.

***

### \_urlConfig

```ts
_urlConfig: 
  | NormalizedUrlConfig
  | null;
```

정규화된 URL 설정. `saveAll()` 에서 URL 조합에 사용된다.

## Methods

### add()

```ts
add(initialData?): DomainState;
```

컬렉션에 새 항목(`DomainState`)을 추가한다.

전달된 `initialData`로 `DomainState.fromJSON()`을 생성한다.
`initialData`가 없으면 빈 객체(`{}`)로 생성한다.
생성된 `DomainState`의 `isNew`는 항상 `true`이다.

#### Parameters

##### initialData?

`object` = `{}`

새 항목의 초기 데이터. 미전달 시 빈 객체.

#### Returns

[`DomainState`](domain.DomainState.Class.DomainState.md)

생성된 `DomainState` 인스턴스.

#### Example

```ts
const state = certs.add({ certName: '정보처리기사', certType: 'IT' });
console.log(certs.getCount()); // +1
```

***

### getCheckedItems()

```ts
getCheckedItems(): DomainState[];
```

체크된 항목(`UIComposer`의 `.dsm-checkbox:checked` 상태) 목록을 반환한다.

v1.4.x에서 `UIComposer`가 각 `DomainState`에 `_checked` 플래그를 주입한다.
현재(v1.3.x)에서는 `UIComposer` 미설치 시 빈 배열을 반환한다.

#### Returns

[`DomainState`](domain.DomainState.Class.DomainState.md)[]

체크된 항목 배열.

***

### getCount()

```ts
getCount(): number;
```

컬렉션 내 항목의 총 수를 반환한다.

#### Returns

`number`

항목 수.

#### Example

```ts
console.log(certs.getCount()); // 3
```

***

### getItems()

```ts
getItems(): DomainState[];
```

컬렉션 내 모든 `DomainState` 인스턴스 배열을 반환한다.

반환된 배열은 내부 배열의 **얕은 복사본**이다.
원본 배열을 직접 수정하지 않도록 복사본을 반환한다.

#### Returns

[`DomainState`](domain.DomainState.Class.DomainState.md)[]

항목 배열.

#### Example

```ts
certs.getItems().forEach(state => console.log(state.data.certName));
```

***

### remove()

```ts
remove(indexOrState): boolean;
```

컬렉션에서 항목을 제거한다.

인덱스(number) 또는 `DomainState` 인스턴스 참조로 제거한다.
존재하지 않는 인덱스나 인스턴스를 전달하면 조용히 no-op으로 처리한다.

## 복수 항목 제거 시 주의사항
복수 인덱스를 연속으로 제거할 때는 반드시 **내림차순(LIFO)으로 정렬** 후 호출해야 한다.
앞 인덱스를 먼저 제거하면 뒤 인덱스가 밀려 잘못된 항목이 제거된다.
`UIComposer.removeChecked()`가 이 순서를 자동으로 보장한다.

#### Parameters

##### indexOrState

`number` \| [`DomainState`](domain.DomainState.Class.DomainState.md)

제거할 항목의 인덱스 또는 `DomainState` 인스턴스.

#### Returns

`boolean`

제거 성공 시 `true`, 항목이 없어 no-op 시 `false`.

#### Examples

```ts
certs.remove(0);
```

```ts
const state = certs.getItems()[0];
certs.remove(state);
```

```ts
// [0, 2] → 내림차순 [2, 0] → remove(2) → remove(0)
[2, 0].forEach(i => certs.remove(i));
```

***

### saveAll()

```ts
saveAll(options?): Promise<void>;
```

컬렉션 전체를 서버와 동기화한다.

## 현재 지원 전략: `'batch'`
배열 전체를 단일 HTTP 요청으로 전송한다.
SI 레거시 환경에서 DELETE ALL + INSERT 또는 MERGE 방식의 백엔드와 호환된다.

## HTTP 메서드 결정
- `_isNew: true` (create()로 생성) → POST
- `_isNew: false` (fromJSONArray()로 생성) → PUT

## 성공 처리
1. `_isNew = false` (최초 POST 성공 후 이후 요청은 PUT)
2. 각 항목의 `clearChangeLog()` + `clearDirtyFields()`
3. `lazy` 모드: `_initialSnapshot`을 현재 상태로 갱신

## 실패 처리
1. `_rollback()`을 각 항목에 적용 (save() 진입 이전 상태 복원)
2. `_isNew` 상태 복원
3. 에러 re-throw — 소비자의 `catch` 블록이 처리할 수 있도록

## `sequential` / `parallel` 전략 예정
v2.x에서 `DomainPipeline` 보상 트랜잭션 완성 이후 연계한다.

#### Parameters

##### options?

[`SaveAllOptions`](domain.DomainCollection.Interface.SaveAllOptions.md) = `...`

저장 옵션.

#### Returns

`Promise`\<`void`\>

#### Throws

`handler`가 주입되지 않은 경우.

#### Throws

지원하지 않는 `strategy`가 전달된 경우.

#### Throws

`path`가 전달되지 않은 경우.

#### Throws

HTTP 에러.

#### Examples

```ts
const certs = DomainCollection.create(api);
certs.add({ certName: '정보처리기사' });
await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
```

```ts
const certs = DomainCollection.fromJSONArray(jsonText, api);
certs.remove(0); // 첫 항목 제거
await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
```

```ts
try {
    await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
} catch (err) {
    // err.status === 409: Conflict 등
    // 각 항목은 saveAll() 진입 이전 상태로 자동 복원됨
    console.error('배열 저장 실패:', err.status);
}
```

***

### toJSON()

```ts
toJSON(): object[];
```

모든 항목의 현재 데이터를 일반 객체 배열로 직렬화한다.

각 항목의 `_getTarget()`(Proxy 원본 객체)을 읽어 배열로 반환한다.
`saveAll({ strategy: 'batch' })`의 request body 생성에 사용된다.

#### Returns

`object`[]

현재 상태의 도메인 객체 배열. Proxy가 아닌 순수 객체.

#### Example

```ts
const payload = JSON.stringify(certs.toJSON());
// → '[{"certId":1,"certName":"정보처리기사"},...]'
```

***

### create()

```ts
static create(handler, options?): DomainCollection;
```

빈 `DomainCollection` 인스턴스를 생성한다. (`_isNew: true`)

이후 `add()`로 항목을 추가하고 `saveAll()`로 서버에 POST한다.

#### Parameters

##### handler

[`ApiHandler`](network.api-handler.Class.ApiHandler.md)

HTTP 전송 레이어.

##### options?

[`DomainCollectionOptions`](domain.DomainCollection.Interface.DomainCollectionOptions.md) = `{}`

컬렉션 옵션.

#### Returns

`DomainCollection`

`_isNew: true`인 빈 컬렉션.

#### Example

```ts
const certs = DomainCollection.create(api, { debug: true });
certs.add({ certName: '정보처리기사', certType: 'IT' });
await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
```

***

### fromJSONArray()

```ts
static fromJSONArray(
   jsonText, 
   handler, 
   options?): DomainCollection;
```

REST API GET 응답 JSON 문자열(배열)로부터 `DomainCollection`을 생성한다. (`_isNew: false`)

JSON 파싱 후 각 항목을 `DomainState.fromJSON()`으로 변환하여 컬렉션에 적재한다.
`lazy` 모드이면 생성 시점의 배열 전체를 `_initialSnapshot`에 저장한다.

## JSON 형식 요구사항
응답 본문의 최상위는 반드시 **JSON 배열**이어야 한다.
객체(`{}`)나 기타 형식이 오면 즉시 `Error`를 throw한다.

#### Parameters

##### jsonText

`string`

`response.text()`로 읽은 GET 응답 JSON 문자열.
  최상위가 배열인 JSON이어야 한다.

##### handler

[`ApiHandler`](network.api-handler.Class.ApiHandler.md)

HTTP 전송 레이어.

##### options?

[`DomainCollectionOptions`](domain.DomainCollection.Interface.DomainCollectionOptions.md) = `{}`

컬렉션 옵션.

#### Returns

`DomainCollection`

`_isNew: false`인 컬렉션.

#### Throws

`jsonText`가 유효하지 않은 JSON인 경우.

#### Throws

파싱된 JSON 최상위가 배열이 아닌 경우.

#### Example

```ts
const jsonText = await fetch('/api/certificates').then(r => r.text());
const certs = DomainCollection.fromJSONArray(jsonText, api, { trackingMode: 'lazy', itemKey: 'certId' });
certs.add({ certName: '신규자격증' });
await certs.saveAll({ strategy: 'batch', path: '/api/certificates' });
```
