## [0.7.0](https://github.com/2davi/rest-domain-state-manager/compare/v0.6.0...v0.7.0) (2026-03-23)

### ✨ Features

* **constants:** add DIRTY_THRESHOLD constant for smart PUT/PATCH routing ([5884097](https://github.com/2davi/rest-domain-state-manager/commit/5884097ad68e9ae87c3e17007b46b9419f91043f))
* **constants:** add SAVE_ROLLBACK error message for rollback event logging ([ecf0ff8](https://github.com/2davi/rest-domain-state-manager/commit/ecf0ff8befec7655e75d59a9db849913ca6a13ee))
* **core:** add dirtyFields tracking to createProxy closure ([d63001c](https://github.com/2davi/rest-domain-state-manager/commit/d63001c261d5a68275bf319a65c2012e8437cb88))
* **core:** add restore methods to ProxyWrapper for optimistic update rollback ([0a05141](https://github.com/2davi/rest-domain-state-manager/commit/0a05141af1926ce5b1cbff82c54eed428d9bfb19))
* **domain:** add microtask-based flush scheduler for broadcast batching ([5187000](https://github.com/2davi/rest-domain-state-manager/commit/5187000d9b890cbe636b12e0b64341afd01f6491))
* **domain:** implement optimistic update rollback in save() ([5d9e63a](https://github.com/2davi/rest-domain-state-manager/commit/5d9e63a29746a66126062252c06c3988f61c669b))
* **domain:** replace save() branching with dirtyFields-based smart routing ([ac462bd](https://github.com/2davi/rest-domain-state-manager/commit/ac462bd46cc7db6f31306e239780757f15e7963f))

### 🐛 Bug Fixes

* **core:** resolve TS errors in restoreTarget, apply Reflect.deleteProperty ([d8fc012](https://github.com/2davi/rest-domain-state-manager/commit/d8fc012a39902ea610e7e31e1c70d0b25ff2e4f2))
* **plugins:** FormRenderer._resolveForm 함수의 반환 로직에서 return 누락 확인 후 조치. ([fe95561](https://github.com/2davi/rest-domain-state-manager/commit/fe955612f884bb8846af2db04aa58586e0447aef))

### ♻️ Refactors

* **domain:** replace direct _broadcast() with _scheduleFlush() in onMutate closures ([80edbd0](https://github.com/2davi/rest-domain-state-manager/commit/80edbd0dca9a55ddf4463e5f95970db3e4dfa7e8))
* **structure, config:** update all import paths, vite, tsconfig, and JSDoc [@module](https://github.com/module) tags for new directory layout ([6e72ec4](https://github.com/2davi/rest-domain-state-manager/commit/6e72ec48b71067eab3657d382d5506d4c69a6295))
* **structure:** move model/, plugin/, handler/ under src/ hierarchy ([8def5f2](https://github.com/2davi/rest-domain-state-manager/commit/8def5f2717bc971d1456e955a7717dc87912d380))
