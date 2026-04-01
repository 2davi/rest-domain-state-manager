# Function: createCollectionBinder()

```ts
function createCollectionBinder(
   collection, 
   containerEl, 
   options): CollectionControls;
```

CollectionBinder 인스턴스를 생성하고 컨트롤 함수 집합을 반환한다.

`UIComposer`의 `bindCollection()` / `DomainCollection.prototype.bind()` 내부에서 호출된다.
소비자가 직접 호출하지 않는다.

## Parameters

### collection

[`DomainCollection`](domain.DomainCollection.Class.DomainCollection.md)

바인딩 대상 컬렉션

### containerEl

`Element`

그리드 컨테이너 DOM 요소

### options

[`CollectionBinderOptions`](ui.collection.CollectionBinder.Interface.CollectionBinderOptions.md)

바인더 옵션

## Returns

[`CollectionControls`](ui.collection.CollectionBinder.Interface.CollectionControls.md)

컨트롤 함수 집합
