# Variable: pipeline

```ts
readonly pipeline: Readonly<{
  afterDone: "[DSM][Pipeline] after 핸들러 완료 | key: {key}";
  afterError: "[DSM][Pipeline] after 핸들러 실패 | key: {key} | error: {error}";
  afterStart: "[DSM][Pipeline] after 핸들러 실행 | key: {key}";
  fetchDone: "[DSM][Pipeline] 병렬 fetch 완료";
  fetchStart: "[DSM][Pipeline] 병렬 fetch 시작 | keys: {keys}";
}>;
```
