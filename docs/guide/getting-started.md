# 빠른 시작 (Getting Started)

`rest-domain-state-manager`는 번들러, npm, 외부 의존성이 전혀 필요 없는 순수 ES Module 라이브러리입니다.

## 1. 설치하기

프로젝트 디렉토리에 폴더째 복사 후 `import`만 하면 끝납니다.

```html
<script type="module">
  import { ApiHandler, DomainState } 
    from './rest-domain-state-manager/rest-domain-state-manager.js';
    
  console.log("DSM 설치 완료!");
</script>
```

> 다음 장에서 `ApiHandler`를 통해 서버와 통신하는 방법을 알아봅니다.