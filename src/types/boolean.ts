import { Schema, ValidationOptions } from '../core/schema';
import { Result, ok, err } from '../core/result';
import { ValidationError } from '../core/errors';

/**
 * Schema for boolean validation
 */
export class BooleanSchema extends Schema<boolean> {
  private readonly _optional: boolean = false;
  private readonly _default?: boolean;
  
  constructor(options: BooleanSchemaOptions = {}) {
    super();
    this._optional = options.optional || false;
    this._default = options.default;
  }

  /**
   * Set a default value for the boolean
   */
  default(value: boolean): BooleanSchema {
    return new BooleanSchema({
      ...this._getOptions(),
      default: value,
    });
  }

  /**
   * Set this boolean as optional
   */
  optional(): Schema<boolean | undefined> {
    return new OptionalBooleanSchema(this);
  }
  
  /**
   * Internal method to get current options
   */
  private _getOptions(): BooleanSchemaOptions {
    return {
      optional: this._optional,
      default: this._default,
    };
  }

  /**
   * Parse and validate boolean data
   */
  _parse(data: unknown, options: ValidationOptions): Result<boolean, ValidationError> {
    const path = options.path || [];

    // Si la valeur est undefined et qu'il y a une valeur par défaut, utilisez-la
    if (data === undefined && this._default !== undefined) {
      return ok(this._default);
    }
  
    // Type check
    if (typeof data !== 'boolean') {
      return err(ValidationError.typeMismatch('boolean', data, path));
    }

    return ok(data);
  }

  /**
   * Generate a partial schema
   * For primitives like boolean, partial means the value is now optional
   */
  partial(): Schema<boolean | undefined> {
    return this.optional();
  }
}

/**
 * Schema for optional boolean
 */
class OptionalBooleanSchema extends Schema<boolean | undefined> {
  constructor(private readonly baseSchema: BooleanSchema) {
    super();
  }
  
  /**
   * Parse and validate boolean data
   */
  _parse(data: unknown, options: ValidationOptions): Result<boolean | undefined, ValidationError> {
    if (data === undefined || data === null) {
      return ok(undefined);
    }
    
    return this.baseSchema._parse(data, options);
  }
  
  /**
   * Generate a partial schema
   */
  partial(): Schema<boolean | undefined> {
    return this;
  }
}

/**
 * Options for boolean schema
 */
export interface BooleanSchemaOptions {
  optional?: boolean;
  default?: boolean;
}

/**
 * Create a boolean schema
 */
export function boolean(options: BooleanSchemaOptions = {}): BooleanSchema {
  return new BooleanSchema(options);
}