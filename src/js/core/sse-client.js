/*
  sse-client: abstraction that chooses between real EventSource and mock generator.
  Usage: core.sseClient.connect(url, { onEvent: fn, onOpen: fn, onError: fn }, { mode, base })
  Returns an object with `close()`.
*/
(function () {
  'use strict';

  const core = window.core || (window.core = {});

  const sseClient = {
    connect(url, handlers = {}, opts = {}) {
      const base = opts.base || '';
      const full = (base.replace(/\/$/, '')) + url;

      if (!window.EventSource) {
        const err = new Error('EventSource not supported in this environment');
        handlers.onError && handlers.onError(err);
        return { close() {} };
      }

      let es = null;
      let closed = false;
      let retryCount = 0;
      const maxDelay = 30000;

      function attachListeners() {
        if (!es) return;
        es.addEventListener('open', e => {
          retryCount = 0;
          handlers.onOpen && handlers.onOpen(e);
        });
        es.addEventListener('error', e => {
          handlers.onError && handlers.onError(e);
          // schedule reconnect unless closed explicitly
          if (!closed) scheduleReconnect();
        });

        const known = ['create_room', 'update_room', 'join_room', 'leave_room', 'player_score', 'start_round'];
        known.forEach(name => {
          es.addEventListener(name, ev => {
            try { handlers.onEvent && handlers.onEvent(name, JSON.parse(ev.data)); }
            catch (err) { handlers.onEvent && handlers.onEvent(name, ev.data); }
          });
        });
        es.addEventListener('message', ev => {
          try { handlers.onEvent && handlers.onEvent('message', JSON.parse(ev.data)); }
          catch (err) { handlers.onEvent && handlers.onEvent('message', ev.data); }
        });
      }

      function createEventSource() {
        es = new EventSource(full);
        attachListeners();
        return es;
      }

      let reconnectTimer = null;
      function scheduleReconnect() {
        if (closed) return;
        retryCount++;
        const delay = Math.min(1000 * Math.pow(2, retryCount - 1), maxDelay);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          try {
            if (es) try { es.close(); } catch (e) {}
            createEventSource();
          } catch (err) {
            handlers.onError && handlers.onError(err);
            scheduleReconnect();
          }
        }, delay);
      }

      // start
      try { createEventSource(); }
      catch (err) { handlers.onError && handlers.onError(err); scheduleReconnect(); }

      return {
        close() {
          closed = true;
          if (reconnectTimer) clearTimeout(reconnectTimer);
          if (es) try { es.close(); } catch (e) {}
        }
      };
    }
  };

  core.sseClient = sseClient;
})();
