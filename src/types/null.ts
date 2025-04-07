import { Schema, ValidationOptions } from '../core/schema';
import { Result, ok, err } from '../core/result';
import { ValidationError } from '../core/errors';

/**
 * Schema for null validation
 */
export class NullSchema extends Schema<null> {
  private readonly _optional: boolean = false;
  
  constructor(options: NullSchemaOptions = {}) {
    super();
    this._optional = options.optional || false;
  }

  /**
   * Set this null as optional
   */
  optional(): Schema<null | undefined> {
    return new OptionalNullSchema(this);
  }
  
  /**
   * Internal method to get current options
   */
  private _getOptions(): NullSchemaOptions {
    return {
      optional: this._optional,
    };
  }

  /**
   * Parse and validate null data
   */
  _parse(data: unknown, options: ValidationOptions): Result<null, ValidationError> {
    const path = options.path || [];

    // Type check
    if (data !== null) {
      return err(ValidationError.typeMismatch('null', data, path));
    }

    return ok(null);
  }

  /**
   * Generate a partial schema
   * For primitives like null, partial means the value is now optional
   */
  partial(): Schema<null | undefined> {
    return this.optional();
  }
}

/**
 * Schema for optional null
 */
class OptionalNullSchema extends Schema<null | undefined> {
  constructor(private readonly baseSchema: NullSchema) {
    super();
  }
  
  /**
   * Parse and validate null data
   */
  _parse(data: unknown, options: ValidationOptions): Result<null | undefined, ValidationError> {
    if (data === undefined) {
      return ok(undefined);
    }
    
    return this.baseSchema._parse(data, options);
  }
  
  /**
   * Generate a partial schema
   */
  partial(): Schema<null | undefined> {
    return this;
  }
}

/**
 * Options for null schema
 */
export interface NullSchemaOptions {
  optional?: boolean;
}

/**
 * Create a null schema
 */
export function nullSchema(options: NullSchemaOptions = {}): NullSchema {
  return new NullSchema(options);
}