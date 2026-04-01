# Interface: CollectionControls

## Properties

### addEmpty

```ts
addEmpty: () => DomainState;
```

빈 행 추가. 새로 생성된 DomainState 반환.

#### Returns

[`DomainState`](domain.DomainState.Class.DomainState.md)

***

### destroy

```ts
destroy: () => void;
```

이벤트 리스너 정리.

#### Returns

`void`

***

### getCheckedItems

```ts
getCheckedItems: () => DomainState[];
```

체크된 DomainState 목록 반환.

#### Returns

[`DomainState`](domain.DomainState.Class.DomainState.md)[]

***

### getCount

```ts
getCount: () => number;
```

총 행 수 반환.

#### Returns

`number`

***

### getItems

```ts
getItems: () => DomainState[];
```

전체 DomainState 목록 반환.

#### Returns

[`DomainState`](domain.DomainState.Class.DomainState.md)[]

***

### invertSelection

```ts
invertSelection: () => void;
```

선택 반전.

#### Returns

`void`

***

### removeAll

```ts
removeAll: () => void;
```

전체 행 삭제.

#### Returns

`void`

***

### removeChecked

```ts
removeChecked: () => void;
```

체크된 행 삭제 (역순 LIFO 정렬 보장).

#### Returns

`void`

***

### selectAll

```ts
selectAll: (checked) => void;
```

전체 행 선택/해제.

#### Parameters

##### checked

`boolean`

#### Returns

`void`

***

### validate

```ts
validate: () => boolean;
```

필수 필드 검증. 유효하면 `true`.

#### Returns

`boolean`
