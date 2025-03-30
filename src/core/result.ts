/**
 * Result type representing either success (Ok) or failure (Err)
 */
export type Result<T, E = Error> = Ok<T, E> | Err<T, E>;

/**
 * Represents a successful operation
 */
export class Ok<T, E = Error> {
  readonly _tag: 'Ok' = 'Ok';
  constructor(private readonly value: T) {}

  /**
   * Check if the result is Ok
   */
  isOk(): this is Ok<T, E> {
    return true;
  }

  /**
   * Check if the result is Err
   */
  isErr(): this is Err<T, E> {
    return false;
  }

  /**
   * Unwrap the value from an Ok result
   */
  unwrap(): T {
    return this.value;
  }

  /**
   * Unwrap the value from an Ok result, or return the default value if Err
   */
  unwrapOr(defaultValue: T): T {
    return this.value;
  }

  /**
   * Unwrap the error, will throw for Ok results
   */
  unwrapErr(): never {
    throw new Error(`Cannot unwrap Error from Ok result with: ${this.value}`);
  }

  /**
   * Map the success value with the given function
   */
  map<U>(fn: (value: T) => U): Result<U, E> {
    return new Ok(fn(this.value));
  }

  /**
   * Map the error value with the given function (no-op for Ok)
   */
  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return new Ok<T, F>(this.value);
  }

  /**
   * Chain Results with the given function
   */
  andThen<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }

  /**
   * Match on the result type with different handlers for Ok and Err
   */
  match<U>(matchers: { ok: (value: T) => U; err: (error: E) => U }): U {
    return matchers.ok(this.value);
  }
}

/**
 * Represents a failed operation
 */
export class Err<T, E = Error> {
  readonly _tag: 'Err' = 'Err';
  constructor(private readonly error: E) {}

  /**
   * Check if the result is Ok
   */
  isOk(): this is Ok<T, E> {
    return false;
  }

  /**
   * Check if the result is Err
   */
  isErr(): this is Err<T, E> {
    return true;
  }

  /**
   * Unwrap the value from an Ok result, will throw for Err results
   */
  unwrap(): never {
    throw new Error(`Cannot unwrap value from Err result with: ${this.error}`);
  }

  /**
   * Unwrap the value from an Ok result, or return the default value if Err
   */
  unwrapOr(defaultValue: T): T {
    return defaultValue;
  }

  /**
   * Unwrap the error from an Err result
   */
  unwrapErr(): E {
    return this.error;
  }

  /**
   * Map the success value with the given function (no-op for Err)
   */
  map<U>(_fn: (value: T) => U): Result<U, E> {
    return new Err<U, E>(this.error);
  }

  /**
   * Map the error value with the given function
   */
  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return new Err<T, F>(fn(this.error));
  }

  /**
   * Chain Results with the given function (no-op for Err)
   */
  andThen<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return new Err<U, E>(this.error);
  }

  /**
   * Match on the result type with different handlers for Ok and Err
   */
  match<U>(matchers: { ok: (value: T) => U; err: (error: E) => U }): U {
    return matchers.err(this.error);
  }
}

/**
 * Create an Ok result
 */
export function ok<T, E = Error>(value: T): Result<T, E> {
  return new Ok<T, E>(value);
}

/**
 * Create an Err result
 */
export function err<T, E = Error>(error: E): Result<T, E> {
  return new Err<T, E>(error);
}