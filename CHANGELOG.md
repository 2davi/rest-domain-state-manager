## [1.2.4](https://github.com/2davi/rest-domain-state-manager/compare/v1.2.3...v1.2.4) (2026-04-02)

### 🐛 Bug Fixes

* **webdoc:** debug Interactive Playground Component - save() HTTP Methods Logic ([018d031](https://github.com/2davi/rest-domain-state-manager/commit/018d031e963e064005037395bdc568b465f5a434))

## [1.2.3](https://github.com/2davi/rest-domain-state-manager/compare/v1.2.2...v1.2.3) (2026-04-02)

### 🐛 Bug Fixes

* nothing. ([61ffea0](https://github.com/2davi/rest-domain-state-manager/commit/61ffea0415903eabefc374bf31c272ff72a870c2))
* **webdoc:** edit config.mts again. ([5692208](https://github.com/2davi/rest-domain-state-manager/commit/56922089d933a7a2277b25f7e58321fe48831846))

## [1.2.2](https://github.com/2davi/rest-domain-state-manager/compare/v1.2.1...v1.2.2) (2026-04-02)

### 🐛 Bug Fixes

* **webdoc:** edit vitepress config.mts - cleanUrls option input. ([2e520c9](https://github.com/2davi/rest-domain-state-manager/commit/2e520c962cd2b0135ef5a14188a5dc90a5502e08))

## [1.2.1](https://github.com/2davi/rest-domain-state-manager/compare/v1.2.0...v1.2.1) (2026-04-02)

### 🐛 Bug Fixes

* **webdoc:** debug VitePress PublicDir location. ([9a0f8ae](https://github.com/2davi/rest-domain-state-manager/commit/9a0f8aed66b399596d0c4f3700961a66a57cc2f2))

## [1.2.0](https://github.com/2davi/rest-domain-state-manager/compare/v1.1.0...v1.2.0) (2026-04-01)

### ✨ Features

* **common:** implement LCS-based deep diff utility for lazy tracking mode ([33f63a0](https://github.com/2davi/rest-domain-state-manager/commit/33f63a0379467eaa3b0f5ce821e1bc5343814e25))
* **core:** add trackingMode branch to Proxy set trap ([0e61e2a](https://github.com/2davi/rest-domain-state-manager/commit/0e61e2a93dc356f6d50fb588d5d710fa64fcbb74))
* **core:** export DomainCollection from index.js ([2e23df9](https://github.com/2davi/rest-domain-state-manager/commit/2e23df9467bc58703b1b1ba6174a805b03f32061))
* **domain:** implement DomainCollection class with create/fromJSONArray factories ([61b6c25](https://github.com/2davi/rest-domain-state-manager/commit/61b6c252587f9b3980f2e18507dff9b19c40e1fa))
* **domain:** integrate trackingMode and lazy diff pipeline into DomainState ([4e3a682](https://github.com/2davi/rest-domain-state-manager/commit/4e3a682eb86bfb10627eb476352b490d88037734))
* **ui:** create src/ui/ layer and UILayout base class ([51a8148](https://github.com/2davi/rest-domain-state-manager/commit/51a8148eaeb83cd5d003ff19aa0285ea49d1cab1))
* **ui:** implement CollectionBinder MVP in src/ui/collection/ ([29df4f5](https://github.com/2davi/rest-domain-state-manager/commit/29df4f5e15a02545433b260939b35927a357c02b))
* **ui:** implement UIComposer plugin installing bind/bindCollection ([f07873c](https://github.com/2davi/rest-domain-state-manager/commit/f07873c64f177c45db9a3d23d004c3930ff3c950))
* **workers:** add diff-worker-client.js for lazy mode with Node.js fallback. ([226e5ea](https://github.com/2davi/rest-domain-state-manager/commit/226e5eae71fe809948c68f861df2750ce1794479))
* **workers:** add diff.worker.js for lazy mode changeLog generation ([9b92a63](https://github.com/2davi/rest-domain-state-manager/commit/9b92a63e3d03138afab5a4ee75d780ff6c07f2d8))

## [1.1.0](https://github.com/2davi/rest-domain-state-manager/compare/v1.0.2...v1.1.0) (2026-04-01)

### ✨ Features

* **domain:** add [#idempotency](https://github.com/2davi/rest-domain-state-manager/issues/idempotency)Key private field to DomainState ([1abd4d2](https://github.com/2davi/rest-domain-state-manager/commit/1abd4d2e12fad41744e6b66006afe3eac46d0093)), closes [#idempotencyKey](https://github.com/2davi/rest-domain-state-manager/issues/idempotencyKey)
* **domain:** implement Idempotency-Key header injection in save() ([72a8520](https://github.com/2davi/rest-domain-state-manager/commit/72a8520d847893b8989cb8a638591abcdd3f54f8)), closes [#idempotencyKey](https://github.com/2davi/rest-domain-state-manager/issues/idempotencyKey) [#idempotencyKey](https://github.com/2davi/rest-domain-state-manager/issues/idempotencyKey) [#idempotencyKey](https://github.com/2davi/rest-domain-state-manager/issues/idempotencyKey) [#idempotencyKey](https://github.com/2davi/rest-domain-state-manager/issues/idempotencyKey) [#idempotencyKey](https://github.com/2davi/rest-domain-state-manager/issues/idempotencyKey)
* **network:** add idempotent option to ApiHandler constructor ([2280888](https://github.com/2davi/rest-domain-state-manager/commit/22808881d51b29a68a7b6925304d73a88d360568))

### 🐛 Bug Fixes

* **webdoc:** playgound components need to use shallowref on Reference of DomainState Objects. ([be281c7](https://github.com/2davi/rest-domain-state-manager/commit/be281c7e7f19ee36f2f73fc15c35538c33f092f5))

## [1.0.2](https://github.com/2davi/rest-domain-state-manager/compare/v1.0.1...v1.0.2) (2026-03-31)

### 🐛 Bug Fixes

* **build:** do missed prettier --write. ([7293619](https://github.com/2davi/rest-domain-state-manager/commit/72936195b0d1b1de10875a0ec2c05488fd8a8b49))

## [1.0.1](https://github.com/2davi/rest-domain-state-manager/compare/v1.0.0...v1.0.1) (2026-03-31)

### 🐛 Bug Fixes

* **docs:** add few details on WebDocs with api.get() error throws switch feature. ([040bfc3](https://github.com/2davi/rest-domain-state-manager/commit/040bfc389c92f63cf5cf73c7020b40963c06651f))

## [1.0.0](https://github.com/2davi/rest-domain-state-manager/compare/v0.11.0...v1.0.0) (2026-03-31)

### ⚠ BREAKING CHANGES

* Really release v1.0.0

### ✨ Features

* Really release v1.0.0 ([3b45974](https://github.com/2davi/rest-domain-state-manager/commit/3b4597402e55553e3b27c3bd1d4c133677f92c44))

## [0.11.0](https://github.com/2davi/rest-domain-state-manager/compare/v0.10.2...v0.11.0) (2026-03-31)

### ⚠ BREAKING CHANGES

* release major version one.

### ✨ Features

* release v1.0.0 ([70ac984](https://github.com/2davi/rest-domain-state-manager/commit/70ac984762857fb1b2014ca6d025720a2d306214))

## [0.10.2](https://github.com/2davi/rest-domain-state-manager/compare/v0.10.1...v0.10.2) (2026-03-30)

### 🐛 Bug Fixes

* **lint:** just edited for resolve lint warnings - Missing JSDoc [@param](https://github.com/param)  descriptions. ([08b48f6](https://github.com/2davi/rest-domain-state-manager/commit/08b48f6515643e2c620103942128295b0f4a1aa1))

## [0.10.1](https://github.com/2davi/rest-domain-state-manager/compare/v0.10.0...v0.10.1) (2026-03-30)

### 🐛 Bug Fixes

* **debug:** correct worker relative path + apply prettier formatting ([7e0bdb6](https://github.com/2davi/rest-domain-state-manager/commit/7e0bdb6f19512561191ac4873c125efd3c2d74ab))

## [0.10.0](https://github.com/2davi/rest-domain-state-manager/compare/v0.9.2...v0.10.0) (2026-03-30)

### ✨ Features

* **adapters:** add useDomainState React hook via subpath export ([09463b3](https://github.com/2davi/rest-domain-state-manager/commit/09463b360713e90dcef4bc39b5e2540c2b45a2a5))
* **adapters:** missed work accomplished" ([cdb704a](https://github.com/2davi/rest-domain-state-manager/commit/cdb704a1100f380ff5737b3678fc8d1075d701c2))
* **common:** add deepFreeze and maybeDeepFreeze utility for immutable snapshots ([97c33ce](https://github.com/2davi/rest-domain-state-manager/commit/97c33ce381e41015e89e14e7fa4ba8641ee9610a))
* **common:** add deepFreeze and maybeDeepFreeze utility for immutable snapshots ([fbc1332](https://github.com/2davi/rest-domain-state-manager/commit/fbc13329b98517707d5f10f42d6917ed9afbb3a9))
* **common:** add logger utility with silent flag and log level control ([fbb7478](https://github.com/2davi/rest-domain-state-manager/commit/fbb7478ca92b30ef48724a7105891756f57ca9a6))
* **common:** add safeClone utility with structuredClone and _cloneDeep fallback ([e61b7f5](https://github.com/2davi/rest-domain-state-manager/commit/e61b7f5a6276939fb3783b4fb409725937f5b74e))
* **constants:** add CSRF_TOKEN_MISSING and CSRF_INIT_NO_TOKEN error messages ([3af60f8](https://github.com/2davi/rest-domain-state-manager/commit/3af60f8a5b286fd6dc1c7121cbe993cf70469ead))
* **constants:** add PIPELINE_ROLLBACK_WARN error message ([aae1f66](https://github.com/2davi/rest-domain-state-manager/commit/aae1f668274451d738a8114da7437dbe0b9b771e))
* **debug:** offload registerTab serialization to serialize worker ([fe73cec](https://github.com/2davi/rest-domain-state-manager/commit/fe73cec9e86fbc2dbe089954a018d3508c93426c))
* **domain:** add [#snapshot](https://github.com/2davi/rest-domain-state-manager/issues/snapshot) field and restore() for compensating transaction ([d3b81f6](https://github.com/2davi/rest-domain-state-manager/commit/d3b81f6b99f3cebb4cdd2af8cd7fc9aa37a2a1ae))
* **domain:** add failurePolicy and compensating transaction to DomainPipeline ([4d9bb6e](https://github.com/2davi/rest-domain-state-manager/commit/4d9bb6e3e54615164a924faab46bacac4d42545d))
* **domain:** extend DomainState.configure() with silent option ([c0fb2d7](https://github.com/2davi/rest-domain-state-manager/commit/c0fb2d7a6ac52249e449aff5c87f88cf2cddde75))
* **domain:** implement Shadow State with structural sharing and subscriber API ([c202da3](https://github.com/2davi/rest-domain-state-manager/commit/c202da31e284e45a43d893fe9d844da4c6ba901e)), closes [#shadowCache](https://github.com/2davi/rest-domain-state-manager/issues/shadowCache) [#listeners](https://github.com/2davi/rest-domain-state-manager/issues/listeners) [#shadowCache](https://github.com/2davi/rest-domain-state-manager/issues/shadowCache)
* **domain:** replace JSON.parse deep copy with safeClone in DomainVO.toSkeleton ([92ac3dc](https://github.com/2davi/rest-domain-state-manager/commit/92ac3dc393ea28cf9d96e125a7c198754ffce38d))
* **network:** add [#csrf](https://github.com/2davi/rest-domain-state-manager/issues/csrf)Token private field and init() to ApiHandler ([7a205a8](https://github.com/2davi/rest-domain-state-manager/commit/7a205a81c266f6928ca9e8efe18e3f7f63322a5f)), closes [#csrfToken](https://github.com/2davi/rest-domain-state-manager/issues/csrfToken) [#csrfToken](https://github.com/2davi/rest-domain-state-manager/issues/csrfToken)
* **network:** inject X-CSRF-Token header for mutating methods in _fetch() ([7a81d27](https://github.com/2davi/rest-domain-state-manager/commit/7a81d27df0711d4711036bb7ae159580aa32be3b)), closes [#csrfToken](https://github.com/2davi/rest-domain-state-manager/issues/csrfToken)
* **workers:** add serializer worker for _stateRegistry broadcast offloading ([436ad5e](https://github.com/2davi/rest-domain-state-manager/commit/436ad5ecdbaea15df94a38d76689a5fa7e1fd664))

### 🐛 Bug Fixes

* **test:** add happy-dom devDependency for Worker test environment ([59a1bd8](https://github.com/2davi/rest-domain-state-manager/commit/59a1bd87270128220b777b80a87fa0737ff0b5a9))

### ⚡ Performance

* **core:** add performance.mark instrumentation to toPatch and registerTab ([c3912a4](https://github.com/2davi/rest-domain-state-manager/commit/c3912a435cd061904c99a84282cc325acf9dc44a))

### ♻️ Refactors

* **config:** add eslint-plugin-import no-cycle rule ([5c8ea2f](https://github.com/2davi/rest-domain-state-manager/commit/5c8ea2fee7091ea82cef32156acf05513c99cb72))
* **core:** resolve TypeScript Error 2556 - tuple type parameter ([310e8fe](https://github.com/2davi/rest-domain-state-manager/commit/310e8feab002fd17ac19312eef5fbdacfd945b19))
* **core:** restructure index.js as composition root via configure() ([003ea47](https://github.com/2davi/rest-domain-state-manager/commit/003ea47cc5189ba5b19d0e0d1f8c1635995c9ef6))
* **domain:** replace PipelineConstructor bridge with configure() DI pattern ([a1f0b17](https://github.com/2davi/rest-domain-state-manager/commit/a1f0b1714f2b06f2498625d0c0ff3094ce0bab4c))

## [0.9.2](https://github.com/2davi/rest-domain-state-manager/compare/v0.9.1...v0.9.2) (2026-03-23)

### 🐛 Bug Fixes

* **README:** added missing README ([a4c3983](https://github.com/2davi/rest-domain-state-manager/commit/a4c398324cd1b2dae6376e48931f072bb281516d))

## [0.9.1](https://github.com/2davi/rest-domain-state-manager/compare/v0.9.0...v0.9.1) (2026-03-23)

### 🐛 Bug Fixes

* **npm:** add publishConfig access public for scoped package ([ac75bd9](https://github.com/2davi/rest-domain-state-manager/commit/ac75bd91931573804bcaaf849bce1b477dfedd18))

## [0.9.0](https://github.com/2davi/rest-domain-state-manager/compare/v0.8.0...v0.9.0) (2026-03-23)

### ✨ Features

* **docs:** add interactive playground and decision log ([f2cf063](https://github.com/2davi/rest-domain-state-manager/commit/f2cf06308e7d767852e3177c8af853e777755054))

## [0.8.0](https://github.com/2davi/rest-domain-state-manager/compare/v0.7.0...v0.8.0) (2026-03-23)

### ⚠ BREAKING CHANGES

* **core:** DomainState factory methods now require ApiHandler as second argument
We redesigned proxy engine architecture.
All factory methods, save() routing, and plugin system are finalized.

### ✨ Features

* **core:** v1.0.0 release — stable API ([115d370](https://github.com/2davi/rest-domain-state-manager/commit/115d370de329b17ae6138ebbce670568acb50ad8))

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
