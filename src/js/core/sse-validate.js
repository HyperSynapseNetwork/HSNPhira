/* sse-validate: 简单事件载荷结构校验，避免前端盲目处理不完整数据 */
(function () {
  'use strict';

  function isObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  function validate(eventName, payload) {
    if (!eventName || payload == null) return false;
    try {
      if (eventName === 'create_room') {
        return isObject(payload) && typeof payload.room === 'string' && isObject(payload.data);
      }
      if (eventName === 'update_room') {
        return isObject(payload) && typeof payload.room === 'string' && isObject(payload.data);
      }
      if (eventName === 'player_score') {
        return isObject(payload) && typeof payload.room === 'string' && isObject(payload.record);
      }
      if (eventName === 'join_room' || eventName === 'leave_room') {
        return isObject(payload) && typeof payload.room === 'string' && (typeof payload.user === 'number' || typeof payload.user === 'string');
      }
      // heartbeat or other events: accept
      return true;
    } catch (err) {
      return false;
    }
  }

  window.core = window.core || {};
  window.core.sseValidate = { validate };
})();
