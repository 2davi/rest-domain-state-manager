# Variable: UIComposer

```ts
const UIComposer: DsmPlugin;
```

`DomainState.use(UIComposer)`으로 설치하는 플러그인 객체.

설치 시 다음 메서드가 추가된다:
- `DomainState.prototype.bindSingle()` — 단일 폼 양방향 바인딩
- `DomainCollection.prototype.bind()` — 그리드 바인딩 (CollectionBinder 위임)
