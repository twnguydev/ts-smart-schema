import { Schema, ValidationOptions } from '../core/schema';
import { Result, ok, err } from '../core/result';
import { ValidationError } from '../core/errors';

/**
 * Schema for number validation
 */
export class NumberSchema extends Schema<number> {
  private readonly _min?: number;
  private readonly _max?: number;
  private readonly _integer: boolean = false;
  private readonly _positive: boolean = false;
  private readonly _negative: boolean = false;
  private readonly _multipleOf?: number;
  private readonly _optional: boolean = false;
  
  constructor(options: NumberSchemaOptions = {}) {
    super();
    this._min = options.min;
    this._max = options.max;
    this._integer = options.integer || false;
    this._positive = options.positive || false;
    this._negative = options.negative || false;
    this._multipleOf = options.multipleOf;
    this._optional = options.optional || false;
  }

  /**
   * Set minimum value validation
   */
  min(value: number): NumberSchema {
    return new NumberSchema({
      ...this._getOptions(),
      min: value,
    });
  }

  /**
   * Set maximum value validation
   */
  max(value: number): NumberSchema {
    return new NumberSchema({
      ...this._getOptions(),
      max: value,
    });
  }

  /**
   * Validate number is an integer
   */
  int(): NumberSchema {
    return new NumberSchema({
      ...this._getOptions(),
      integer: true,
    });
  }

  /**
   * Validate number is positive (> 0)
   */
  positive(): NumberSchema {
    return new NumberSchema({
      ...this._getOptions(),
      positive: true,
      negative: false,
    });
  }

  /**
   * Validate number is negative (< 0)
   */
  negative(): NumberSchema {
    return new NumberSchema({
      ...this._getOptions(),
      negative: true,
      positive: false,
    });
  }

  /**
   * Validate number is a multiple of the given value
   */
  multipleOf(value: number): NumberSchema {
    return new NumberSchema({
      ...this._getOptions(),
      multipleOf: value,
    });
  }


  /**
   * Set this number as optional
   */
  optional(): Schema<number | undefined> {
    return new OptionalNumberSchema(this);
  }
  
  /**
   * Internal method to get current options
   */
  private _getOptions(): NumberSchemaOptions {
    return {
      min: this._min,
      max: this._max,
      integer: this._integer,
      positive: this._positive,
      negative: this._negative,
      multipleOf: this._multipleOf,
      optional: this._optional,
    };
  }

  /**
   * Parse and validate number data
   */
  _parse(data: unknown, options: ValidationOptions): Result<number, ValidationError> {
    const path = options.path || [];

    // Type check
    if (typeof data !== 'number' || Number.isNaN(data)) {
      return err(ValidationError.typeMismatch('number', data, path));
    }

    const value = data;
    const issues = [];

    // Integer validation
    if (this._integer && !Number.isInteger(value)) {
      issues.push(this.issue(
        'Number must be an integer',
        'number.integer',
        path
      ));
    }

    // Positive validation
    if (this._positive && value <= 0) {
      issues.push(this.issue(
        'Number must be positive',
        'number.positive',
        path,
        { value }
      ));
    }

    // Negative validation
    if (this._negative && value >= 0) {
      issues.push(this.issue(
        'Number must be negative',
        'number.negative',
        path,
        { value }
      ));
    }

    // Min validation
    if (this._min !== undefined && value < this._min) {
      issues.push(this.issue(
        `Number must be greater than or equal to ${this._min}`,
        'number.min',
        path,
        { min: this._min, value }
      ));
    }

    // Max validation
    if (this._max !== undefined && value > this._max) {
      issues.push(this.issue(
        `Number must be less than or equal to ${this._max}`,
        'number.max',
        path,
        { max: this._max, value }
      ));
    }

    // Multiple of validation
    if (this._multipleOf !== undefined) {
      const remainder = value % this._multipleOf;
      // Account for floating point precision issues
      const isMultiple = Math.abs(remainder) < Number.EPSILON ||
        Math.abs(remainder - this._multipleOf) < Number.EPSILON;

      if (!isMultiple) {
        issues.push(this.issue(
          `Number must be a multiple of ${this._multipleOf}`,
          'number.multiple_of',
          path,
          { multipleOf: this._multipleOf, value }
        ));
      }
    }

    if (issues.length > 0) {
      return err(this.validationError(issues));
    }

    return ok(value);
  }

  /**
   * Generate a partial schema
   * For primitives like number, partial means the value is now optional
   */
  partial(): Schema<number | undefined> {
    return this.optional();
  }
}

/**
 * Schema for optional number
 */
class OptionalNumberSchema extends Schema<number | undefined> {
  constructor(private readonly baseSchema: NumberSchema) {
    super();
  }
  
  /**
   * Parse and validate number data
   */
  _parse(data: unknown, options: ValidationOptions): Result<number | undefined, ValidationError> {
    if (data === undefined || data === null) {
      return ok(undefined);
    }
    
    return this.baseSchema._parse(data, options);
  }
  
  /**
   * Generate a partial schema
   */
  partial(): Schema<number | undefined> {
    return this;
  }
}

/**
 * Options for number schema
 */
export interface NumberSchemaOptions {
  min?: number;
  max?: number;
  integer?: boolean;
  positive?: boolean;
  negative?: boolean;
  multipleOf?: number;
  optional?: boolean;
}

/**
 * Create a number schema
 */
export function number(options: NumberSchemaOptions = {}): NumberSchema {
  return new NumberSchema(options);
}