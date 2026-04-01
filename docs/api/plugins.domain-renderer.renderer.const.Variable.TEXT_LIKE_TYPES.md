# Variable: TEXT\_LIKE\_TYPES

```ts
const readonly TEXT_LIKE_TYPES: ReadonlySet<string>;
```

`TRACK_EVENT.TEXT` 전략(`blur` 이벤트)을 적용할 텍스트 계열 input type 집합.

`FormBinder.js`의 `_bindFormEvents()`에서
`input` 이벤트 리스너 내부에 `e.target.type`이 이 집합에 포함되는지 확인하여
text 계열은 `focusout`으로, 그 외는 `input`으로 갱신 전략을 분리한다.

`'textarea'`는 `el.tagName.toLowerCase()`가 `'textarea'`이므로 `el.type`이 다를 수 있으나,
`FormBinder.js` 구현에서 `['text', 'password', 'email', 'textarea'].includes(e.target.type)`
패턴으로 직접 비교하므로 여기에도 포함되어 있다.

## Example

```ts
if (TEXT_LIKE_TYPES.has(el.type)) {
    el.addEventListener('blur', handler);   // 포커스 이탈 시 1회
} else {
    el.addEventListener('change', handler); // 선택 즉시
}
```
