import { Schema, ValidationOptions } from '../core/schema';
import { Result, ok } from '../core/result';
import { ValidationError } from '../core/errors';

/**
 * Schema for any type
 */
export class AnySchema extends Schema<any> {
  /**
   * Set this any as optional
   */
  optional(): Schema<any | undefined> {
    return new OptionalAnySchema(this);
  }

  /**
   * Parse and validate any data
   */
  _parse(data: unknown, options: ValidationOptions): Result<any, ValidationError> {
    // No validation, accept any value
    return ok(data);
  }

  /**
   * Generate a partial schema
   * For any schema, partial is the same
   */
  partial(): Schema<any> {
    return this;
  }
}

/**
 * Schema for optional any
 */
class OptionalAnySchema extends Schema<any | undefined> {
  constructor(private readonly baseSchema: AnySchema) {
    super();
  }
  
  /**
   * Parse and validate any data
   */
  _parse(data: unknown, options: ValidationOptions): Result<any | undefined, ValidationError> {
    if (data === undefined) {
      return ok(undefined);
    }
    
    return this.baseSchema._parse(data, options);
  }
  
  /**
   * Generate a partial schema
   */
  partial(): Schema<any | undefined> {
    return this;
  }
}

/**
 * Create any schema
 */
export function any(): AnySchema {
  return new AnySchema();
}