# Function: broadcastUpdate()

```ts
function broadcastUpdate(label, snapshot): void;
```

`DomainState`의 상태 변경을 채널에 broadcast하고 `_stateRegistry`를 갱신한다.

`DomainState._broadcast()` 내부에서 호출된다.
`debug: true`인 인스턴스가 생성될 때, 필드가 변경될 때, `save()` 성공 후 호출된다.

채널이 `null`이면 (BroadcastChannel 미지원 환경) 메시지 전송을 건너뛰지만
`_stateRegistry` 갱신은 수행한다.

## Parameters

### label

`string`

`DomainState`의 식별 레이블

### snapshot

[`BroadcastSnapshot`](debug.debug-channel.Interface.BroadcastSnapshot.md)

현재 상태 스냅샷 (`data`, `changeLog`, `isNew`, `errors`)

## Returns

`void`

## Example

```ts
// DomainState 내부:
_broadcast() {
    broadcastUpdate(this._label, {
        data:      this._getTarget(),
        changeLog: this._getChangeLog(),
        isNew:     this._isNew,
        errors:    this._errors,
    });
}
```
