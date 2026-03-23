# @2davi/rest-domain-state-manager

[![npm version](https://img.shields.io/npm/v/@2davi/rest-domain-state-manager)](https://www.npmjs.com/package/@2davi/rest-domain-state-manager)
[![CI](https://github.com/2davi/rest-domain-state-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/2davi/rest-domain-state-manager/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

A **framework-agnostic ES Module** that wraps backend DTOs with a JS Proxy, tracks field-level changes, and automatically routes `save()` to the correct HTTP method — `POST`, `PUT`, or `PATCH` — based on a Dirty Checking algorithm.

Built for legacy SI/SM environments where manual form-data assembly and HTTP method decisions create repetitive, error-prone boilerplate.

---

## The Problem

```javascript
// ❌ What you write today — every single time
const payload = {
    name:  document.getElementById('name').value,
    email: document.getElementById('email').value,
    city:  document.getElementById('city').value,
    // ...repeat for every field
};

const method = isNew ? 'POST' : hasChanges ? 'PATCH' : 'PUT';
await fetch('/api/users/1', { method, body: JSON.stringify(payload) });
// Is this payload complete? Is the method correct? No guarantee.
```

## The Solution

```javascript
// ✅ With DSM — the library decides
import { ApiHandler, DomainState } from '@2davi/rest-domain-state-manager';

const api  = new ApiHandler({ host: 'localhost:8080', debug: true });
const user = await api.get('/api/users/1');  // isNew: false

user.data.name = 'Davi';         // Proxy records the change
user.data.address.city = 'Seoul'; // Nested objects tracked too

await user.save('/api/users/1');
// → PATCH  (2 of 5 fields changed, dirtyRatio 40% < threshold)
// → RFC 6902 JSON Patch payload, automatically constructed
```

If `save()` fails, all four internal states (`domainObject`, `changeLog`, `dirtyFields`, `isNew`) are atomically rolled back to the pre-save snapshot. Safe to retry immediately.

---

## Installation

```bash
npm install @2davi/rest-domain-state-manager
```

```javascript
import { ApiHandler, DomainState, DomainVO } from '@2davi/rest-domain-state-manager';
```

Requires Node.js ≥ 20. Browsers: Chrome 94+, Firefox 93+, Safari 15.4+.

---

## HTTP Method Routing

`save()` determines the HTTP method from two internal states:

| Condition                             | Method    | RFC Rationale                                                              |
| ------------------------------------- | --------- | ---------------------------------------------------------------------------|
| `isNew === true`                      | **POST**  | Resource does not yet exist on the server                                  |
| `isNew === false`, no changes         | **PUT**   | Intentional re-save; idempotent full replacement                           |
| `isNew === false`, `dirtyRatio ≥ 0.7` | **PUT**   | >70% fields changed; full replacement is more efficient than a Patch array |
| `isNew === false`, `dirtyRatio < 0.7` | **PATCH** | Partial update; RFC 6902 JSON Patch payload                                |

---

## Key Features

- **Automatic change tracking** — `set`, `deleteProperty`, and array mutation methods (`push`, `splice`, `sort`, …) are all intercepted. Nested objects tracked without configuration.
- **RFC 6902-compliant PATCH payload** — The internal `changeLog` is serialized directly as a JSON Patch array.
- **Optimistic rollback** — HTTP failure restores all state to the pre-`save()` snapshot via `structuredClone`. Retry-safe by design.
- **V8-optimized Proxy engine** — WeakMap-based Lazy Proxying, `Reflect` API throughout, and a mathematical array Delta algorithm avoid Hidden Class pollution.
- **Plugin system** — `FormBinder` and `DomainRenderer` are optional DOM-dependent plugins. Core engine runs in Node.js without a DOM.
- **Built-in multi-tab debugger** — `BroadcastChannel`-based debug popup with Heartbeat GC for automatic stale-tab cleanup.

---

## Documentation

Full guides, architecture deep-dives, and interactive Playgrounds:
**[lab.the2davi.dev/rest-domain-state-manager](https://lab.the2davi.dev/rest-domain-state-manager)**

- [5-Minute Quick Start](https://lab.the2davi.dev/rest-domain-state-manager/guide/quick-start)
- [save() Routing Strategy](https://lab.the2davi.dev/rest-domain-state-manager/guide/save-strategy)
- [Proxy Engine Deep Dive](https://lab.the2davi.dev/rest-domain-state-manager/architecture/proxy-engine)
- [API Reference](https://lab.the2davi.dev/rest-domain-state-manager/api/domain.DomainState.Class.DomainState)

---

## License

ISC © 2026 [2davi](https://github.com/2davi)
