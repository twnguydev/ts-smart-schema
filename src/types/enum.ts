import { Schema, ValidationOptions } from '../core/schema';
import { Result, ok, err } from '../core/result';
import { ValidationError } from '../core/errors';

/**
 * Schema for enum validation
 */
export class EnumSchema<T extends readonly any[]> extends Schema<T[number]> {
  constructor(private readonly values: T) {
    super();
  }

  /**
   * Parse and validate enum value
   */
  _parse(data: unknown, options: ValidationOptions): Result<T[number], ValidationError> {
    const path = options.path || [];

    // Check if value is in enum
    if (!this.values.includes(data)) {
      return err(
        new ValidationError([
          this.issue(
            `Invalid enum value. Expected one of: ${this.values.join(', ')}`,
            'enum.invalid',
            path,
            { expected: this.values, received: data }
          ),
        ])
      );
    }

    return ok(data as T[number]);
  }

  /**
   * Generate a partial schema
   * For enums, partial is the same as the original
   */
  partial(): Schema<T[number]> {
    return this;
  }
}

/**
 * Create an enum schema
 */
export function createEnum<T extends readonly any[]>(
  values: T
): EnumSchema<T> {
  return new EnumSchema(values);
}