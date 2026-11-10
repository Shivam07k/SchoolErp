/* Express 4 does not catch rejected promises from async route handlers.
   Without this shim an async route that throws (for example on a malformed
   payload or a DB constraint) leaves the request hanging and logs an
   unhandled rejection. Wrap every request handler so rejections are forwarded
   to the central error middleware and the API always answers JSON. */
import Layer from 'express/lib/router/layer.js';

const descriptor = Object.getOwnPropertyDescriptor(Layer.prototype, 'handle');
if (!descriptor || !descriptor.set) {
  Object.defineProperty(Layer.prototype, 'handle', {
    enumerable: true,
    configurable: true,
    get() {
      return this.__asyncHandle;
    },
    set(fn) {
      // Error handlers take four arguments and must be left untouched.
      if (typeof fn !== 'function' || fn.length >= 4) {
        this.__asyncHandle = fn;
        return;
      }
      this.__asyncHandle = function asyncHandler(req, res, next) {
        try {
          const result = fn.call(this, req, res, next);
          if (result && typeof result.catch === 'function') result.catch(next);
          return result;
        } catch (err) {
          next(err);
        }
      };
    },
  });
}
