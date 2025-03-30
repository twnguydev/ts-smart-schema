import { Schema } from './schema';
import { Result, ok, err } from './result';
import { ValidationError } from './errors';

/**
 * Mapping function for converting from source to target
 */
export type ToMappingFn<S, T, K extends keyof T = keyof T> = {
  [P in K]: (source: S) => T[P];
};

/**
 * Mapping function for converting from target to source
 */
export type FromMappingFn<S, T, K extends keyof S = keyof S> = {
  [P in K]: (target: T) => S[P];
};

/**
 * Bidirectional mapping configuration
 */
export interface BiMapConfig<S, T> {
  /**
   * Mapping functions for converting from source to target
   */
  to: ToMappingFn<S, T, keyof T>;

  /**
   * Mapping functions for converting from target to source
   */
  from: FromMappingFn<S, T, keyof S>;
}

/**
 * A bidirectional mapping between two schemas
 */
export class BiMap<S, T> {
  constructor(
    private readonly sourceSchema: Schema<S>,
    private readonly targetSchema: Schema<T>,
    private readonly config: BiMapConfig<S, T>
  ) { }

  /**
     * Convert from source to target type
     */
  to(source: S): Result<T, ValidationError> {
    const target = {} as Record<string, any>;

    // Apply transformation
    for (const [key, fn] of Object.entries(this.config.to)) {
      const mapper = fn as (source: S) => any;
      target[key] = mapper(source);
    }

    return this.targetSchema.safeParse(target);
  }

  /**
   * Convert from target to source type
   */
  from(target: T): Result<S, ValidationError> {
    const source = {} as Record<string, any>;

    for (const [key, fn] of Object.entries(this.config.from)) {
      const mapper = fn as (target: T) => any;
      source[key] = mapper(target);
    }

    return this.sourceSchema.safeParse(source);
  }

  /**
   * Convert from source to target and validate
   */
  toAndValidate(source: S): T {
    const result = this.to(source);

    if (result.isErr()) {
      throw result.unwrapErr();
    }

    return result.unwrap();
  }

  /**
   * Convert from target to source and validate
   */
  fromAndValidate(target: T): S {
    const result = this.from(target);

    if (result.isErr()) {
      throw result.unwrapErr();
    }

    return result.unwrap();
  }
}

/**
 * Create a bidirectional mapping between two schemas
 */
export function biMap<S, T>(
  sourceSchema: Schema<S>,
  targetSchema: Schema<T>,
  config: BiMapConfig<S, T>
): BiMap<S, T> {
  return new BiMap(sourceSchema, targetSchema, config);
}