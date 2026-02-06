/*
  core.eventBus
  - Events must be declared before use (per spec). Provide sync/async emit and lifecycle hooks.
*/
(function () {
  'use strict';

  function createEventRecord() {
    return {
      handlers: [],
      hooks: {
        beforeEmit: null,
        afterEmit: null,
        onError: null
      }
    };
  }

  function EventBus() {
    this._events = Object.create(null);
  }

  EventBus.prototype.declare = function (eventName) {
    if (!this._events[eventName]) this._events[eventName] = createEventRecord();
  };

  EventBus.prototype.on = function (eventName, handler) {
    this.declare(eventName);
    this._events[eventName].handlers.push(handler);
    return () => this.off(eventName, handler);
  };

  EventBus.prototype.off = function (eventName, handler) {
    const rec = this._events[eventName];
    if (!rec) return;
    rec.handlers = rec.handlers.filter(h => h !== handler);
  };

  EventBus.prototype.hook = function (eventName, hooks) {
    this.declare(eventName);
    const rec = this._events[eventName];
    rec.hooks = Object.assign({}, rec.hooks, hooks || {});
  };

  // options: { async: boolean }
  EventBus.prototype.emit = async function (eventName, payload, options) {
    const rec = this._events[eventName];
    if (!rec) {
      console.warn('[core.eventBus] emit undeclared event:', eventName);
      return;
    }

    const { beforeEmit, afterEmit, onError } = rec.hooks;

    try {
      if (typeof beforeEmit === 'function') beforeEmit(eventName, payload);

      if (options && options.async) {
        await Promise.all(rec.handlers.map(h => Promise.resolve().then(() => h(payload))));
      } else {
        rec.handlers.forEach(h => h(payload));
      }

      if (typeof afterEmit === 'function') afterEmit(eventName, payload);
    } catch (err) {
      if (typeof onError === 'function') onError(err, eventName, payload);
      else console.error('[core.eventBus] handler error', err);
    }
  };

  // expose
  window.core = window.core || {};
  window.core.eventBus = new EventBus();
  // shorthand for scripts
  window.core_eventBus = window.core.eventBus;

})();
