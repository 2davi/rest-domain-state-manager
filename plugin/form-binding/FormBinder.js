/**
 * @fileoverview FormBinder — HTML 폼 자동 바인딩 플러그인
 *
 * DomainState 코어 엔진에 DOM 의존성을 주입하는 플러그인이다.
 * 이 플러그인을 설치(DomainState.use)하면 다음 기능이 활성화된다:
 * 1. 정적 팩토리: DomainState.fromForm(formEl, handler, opts)
 * 2. 인스턴스 메서드: domainState.bindForm(formEl)
 *
 * @module plugin/form-binding/FormBinder
 */

import { _setNestedValue } from '../../src/common/js-object-util.js';
import { createProxy }     from '../../src/core/api-proxy.js';

export const FormBinder = {
    /**
     * DomainState 클래스에 폼 바인딩 기능을 주입한다.
     * @param {typeof import('../../model/DomainState.js').DomainState} DomainStateClass
     */
    install(DomainStateClass) {
        
        // ── 1. 정적 팩토리 메서드 주입 (DomainState.fromForm) ─────────────
        DomainStateClass.fromForm = function(formOrId, handler, options = {}) {
            const formEl = _resolveForm(formOrId);
            if (!formEl) throw new Error('[DSM] 유효한 HTMLFormElement가 아닙니다.');

            const skeleton = _formToSkeleton(formEl);
            const wrapper  = createProxy(skeleton);
            
            const state = new DomainStateClass(wrapper, {
                handler,
                urlConfig: options.urlConfig,
                isNew:     true,
                debug:     options.debug,
                label:     options.label ?? formEl.id ?? 'form_state',
            });

            _bindFormEvents(formEl, wrapper.getTarget(), wrapper.proxy);
            return state;
        };

        // ── 2. 인스턴스 메서드 주입 (domainState.bindForm) ───────────────
        DomainStateClass.prototype.bindForm = function(formOrId) {
            const formEl = _resolveForm(formOrId);
            if (!formEl) return this;

            // 현재 Proxy 상태를 폼에 동기화하고, 이벤트 리스너를 붙인다.
            _syncToForm(formEl, this._getTarget());
            _bindFormEvents(formEl, this._getTarget(), this.data);
            return this;
        };
    }
};

// ══════════════════════════════════════════════════════════════════════════════
// 내부 DOM 유틸리티 (코어에서 분리되어 오직 이 플러그인 안에서만 산다)
// ══════════════════════════════════════════════════════════════════════════════

function _resolveForm(formOrId) {
    if (typeof formOrId === 'string') return document.getElementById(formOrId);
    if (formOrId instanceof HTMLFormElement) return formOrId;
    return null;
}

function _formToSkeleton(formEl) {
    const obj = {};
    for (const el of formEl.elements) {
        if (!el.name) continue;
        const val = el.type === 'checkbox' ? el.checked : el.value;
        _setNestedValue(obj, el.name, val);
    }
    return obj;
}

function _syncToForm(formEl, targetObj) {
    for (const el of formEl.elements) {
        if (!el.name) continue;
        const keys = el.name.split('.');
        let val = targetObj;
        for (const k of keys) {
            if (val == null) break;
            val = val[k];
        }
        if (val !== undefined && val !== null) {
            if (el.type === 'checkbox' || el.type === 'radio') el.checked = (el.value === String(val));
            else el.value = val;
        }
    }
}

function _bindFormEvents(formEl, targetObj, proxyObj) {
    formEl.addEventListener('input', (e) => {
        if (!e.target.name) return;
        // input[type=text] 등은 blur 시점에 동기화 (타이핑 중 잦은 프록시 호출 방지)
        if (['text', 'password', 'email', 'textarea'].includes(e.target.type)) return;
        
        const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        _setNestedValue(proxyObj, e.target.name, val); // targetObj가 아닌 proxyObj를 조작해 이력 기록
    });

    formEl.addEventListener('focusout', (e) => {
        if (!e.target.name) return;
        if (['text', 'password', 'email', 'textarea'].includes(e.target.type)) {
            _setNestedValue(proxyObj, e.target.name, e.target.value);
        }
    });
}