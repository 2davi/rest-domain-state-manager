# Interface: UrlConfig

## Properties

### basePath?

```ts
optional basePath?: string;
```

모든 요청에 공통으로 붙는 경로 접두사. (Context Path + 추가 경로)
  예: `'/app/api'`, `'/v1'`
  `host` 방식 사용 시 별도 지정.
  `baseURL` 방식 사용 시 `baseURL` 파싱으로 자동 추출.

***

### baseURL?

```ts
optional baseURL?: string;
```

`host + basePath`를 하나의 문자열로 합친 통합 URL 설정.
  프로토콜 접두사(`http://` 등)가 포함된 경우 자동으로 제거된다.
  예: `'localhost:8080/api'`, `'https://api.example.com/v1'`
  `host`와 택일.

***

### debug?

```ts
optional debug?: boolean;
```

`true`이면 개발 환경으로 간주하여 HTTP를 기본 프로토콜로 사용한다.
  `env`가 명시된 경우 `debug`보다 `env`가 우선한다.

***

### env?

```ts
optional env?: string;
```

실행 환경 식별자. 프로토콜 자동 결정에 사용된다.
  허용값: `'development'` | `'production'`

***

### host?

```ts
optional host?: string;
```

프로토콜을 제외한 호스트 문자열.
  예: `'api.example.com'`, `'localhost:8080'`
  `baseURL`과 택일.

***

### protocol?

```ts
optional protocol?: string;
```

사용할 프로토콜 키. 대소문자 무관.
  허용값: `'HTTP'` | `'HTTPS'` | `'FILE'` | `'SSH'`
  미입력 시 `env` / `debug` 플래그로 자동 결정된다.
