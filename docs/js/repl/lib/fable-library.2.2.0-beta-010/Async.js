import { OperationCanceledError, Trampoline } from "./AsyncBuilder.js";
import { protectedCont } from "./AsyncBuilder.js";
import { protectedBind } from "./AsyncBuilder.js";
import { protectedReturn } from "./AsyncBuilder.js";
import { choice1, choice2 } from "./Option.js";
import { map } from "./Seq.js"; // Implemented just for type references

export default class Async {}

function emptyContinuation(x) {} // NOP
// MakeAsync: body:(AsyncActivation<'T> -> AsyncReturn) -> Async<'T>


export function makeAsync(body) {
  return body;
} // Invoke: computation: Async<'T> -> ctxt:AsyncActivation<'T> -> AsyncReturn

export function invoke(computation, ctx) {
  return computation(ctx);
} // CallThenInvoke: ctxt:AsyncActivation<'T> -> result1:'U -> part2:('U -> Async<'T>) -> AsyncReturn

export function callThenInvoke(ctx, result1, part2) {
  return part2(result1)(ctx);
} // Bind: ctxt:AsyncActivation<'T> -> part1:Async<'U> -> part2:('U -> Async<'T>) -> AsyncReturn

export function bind(ctx, part1, part2) {
  return protectedBind(part1, part2)(ctx);
}
export function createCancellationToken(arg) {
  const token = {
    isCancelled: false
  };

  if (typeof arg === "number") {
    setTimeout(() => {
      token.isCancelled = true;
    }, arg);
  } else if (typeof arg === "boolean") {
    token.isCancelled = arg;
  }

  return token;
}
export function cancel(token) {
  token.isCancelled = true;
}
export function cancelAfter(token, ms) {
  setTimeout(() => {
    token.isCancelled = true;
  }, ms);
}
export function isCancellationRequested(token) {
  return token != null && token.isCancelled;
}
export function startChild(computation) {
  const promise = startAsPromise(computation); // JS Promises are hot, computation has already started
  // but we delay returning the result

  return protectedCont(ctx => protectedReturn(awaitPromise(promise))(ctx));
}
export function awaitPromise(p) {
  return fromContinuations(conts => p.then(conts[0]).catch(err => (err instanceof OperationCanceledError ? conts[2] : conts[1])(err)));
}
export function cancellationToken() {
  return protectedCont(ctx => ctx.onSuccess(ctx.cancelToken));
}
export const defaultCancellationToken = {
  isCancelled: false
};
export function catchAsync(work) {
  return protectedCont(ctx => {
    work({
      onSuccess: x => ctx.onSuccess(choice1(x)),
      onError: ex => ctx.onSuccess(choice2(ex)),
      onCancel: ctx.onCancel,
      cancelToken: ctx.cancelToken,
      trampoline: ctx.trampoline
    });
  });
}
export function fromContinuations(f) {
  return protectedCont(ctx => f([ctx.onSuccess, ctx.onError, ctx.onCancel]));
}
export function ignore(computation) {
  return protectedBind(computation, x => protectedReturn(void 0));
}
export function parallel(computations) {
  return awaitPromise(Promise.all(map(w => startAsPromise(w), computations)));
}
export function sleep(millisecondsDueTime) {
  return protectedCont(ctx => {
    setTimeout(() => ctx.cancelToken.isCancelled ? ctx.onCancel(new OperationCanceledError()) : ctx.onSuccess(void 0), millisecondsDueTime);
  });
}
export function start(computation, cancellationToken) {
  return startWithContinuations(computation, cancellationToken);
}
export function startImmediate(computation, cancellationToken) {
  return start(computation, cancellationToken);
}
export function startWithContinuations(computation, continuation, exceptionContinuation, cancellationContinuation, cancelToken) {
  if (typeof continuation !== "function") {
    cancelToken = continuation;
    continuation = null;
  }

  const trampoline = new Trampoline();
  computation({
    onSuccess: continuation ? continuation : emptyContinuation,
    onError: exceptionContinuation ? exceptionContinuation : emptyContinuation,
    onCancel: cancellationContinuation ? cancellationContinuation : emptyContinuation,
    cancelToken: cancelToken ? cancelToken : defaultCancellationToken,
    trampoline
  });
}
export function startAsPromise(computation, cancellationToken) {
  return new Promise((resolve, reject) => startWithContinuations(computation, resolve, reject, reject, cancellationToken ? cancellationToken : defaultCancellationToken));
}
