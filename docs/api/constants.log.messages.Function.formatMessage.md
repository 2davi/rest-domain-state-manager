# Function: formatMessage()

> **formatMessage**(`template`, `values?`): `string`

formatMessage() : 로그 메시지 템플릿의 {placeholder}를 실제 값으로 치환한다.

- 객체/배열 값은 JSON.stringify()로 변환
- undefined/null은 문자열로 변환
- 치환 키가 없으면 {key} 원문 유지

## Parameters

### template

`string`

LOG 내 템플릿 문자열

### values?

`Record`\<`string`, `any`\> = `{}`

{키: 값} 치환 쌍

## Returns

`string`

치환 완료된 메시지 문자열

## Example

```ts
formatMessage(LOG.proxy[OP.REPLACE], { path: '/name', oldValue: 'A', newValue: 'B' });
// → '[DSM][Proxy][replace] path: /name | oldValue: A → B'
```
