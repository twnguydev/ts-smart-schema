import { Schema, ValidationOptions } from '../core/schema';
import { Result, ok, err } from '../core/result';
import { ValidationError, ValidationIssue } from '../core/errors';

/**
 * Schema for string validation
 */
export class StringSchema extends Schema<string> {
  private readonly _minLength?: number;
  private readonly _maxLength?: number;
  private readonly _pattern?: RegExp;
  private readonly _format?: StringFormat;
  private readonly _trim: boolean = false;
  private readonly _optional: boolean = false;
  
  constructor(options: StringSchemaOptions = {}) {
    super();
    this._minLength = options.minLength;
    this._maxLength = options.maxLength;
    this._pattern = options.pattern;
    this._format = options.format;
    this._trim = options.trim || false;
    this._optional = options.optional || false;
  }

  /**
   * Set string pattern validation with regex
   */
  regex(pattern: RegExp): StringSchema {
    return new StringSchema({
      ...this._getOptions(),
      pattern,
    });
  }

  /**
   * Set minimum length validation
   */
  min(length: number): StringSchema {
    return new StringSchema({
      ...this._getOptions(),
      minLength: length,
    });
  }
  
  /**
   * Set maximum length validation
   */
  max(length: number): StringSchema {
    return new StringSchema({
      ...this._getOptions(),
      maxLength: length,
    });
  }

  /**
   * Specify that string should be trimmed before validation
   */
  trim(): StringSchema {
    return new StringSchema({
      ...this._getOptions(),
      trim: true,
    });
  }

  /**
   * Validate string is an email
   */
  email(): StringSchema {
    return new StringSchema({
      ...this._getOptions(),
      format: 'email',
    });
  }

  /**
   * Validate string is a URL
   */
  url(): StringSchema {
    return new StringSchema({
      ...this._getOptions(),
      format: 'url',
    });
  }

  /**
   * Validate string is a UUID
   */
  uuid(): StringSchema {
    return new StringSchema({
      ...this._getOptions(),
      format: 'uuid',
    });
  }

  /**
   * Set this string as optional
   */
  optional(): Schema<string | undefined> {
    return new OptionalStringSchema(this);
  }
  
  /**
   * Internal method to get current options
   */
  private _getOptions(): StringSchemaOptions {
    return {
      minLength: this._minLength,
      maxLength: this._maxLength,
      pattern: this._pattern,
      format: this._format,
      trim: this._trim,
      optional: this._optional,
    };
  }

  /**
   * Parse and validate string data
   */
  _parse(data: unknown, options: ValidationOptions): Result<string, ValidationError> {
    const path = options.path || [];

    // Type check
    if (typeof data !== 'string') {
      return err(ValidationError.typeMismatch('string', data, path));
    }

    // Apply transformations
    let value = data;
    if (this._trim) {
      value = value.trim();
    }

    const issues = [];

    // Min length validation
    if (this._minLength !== undefined && value.length < this._minLength) {
      issues.push(this.issue(
        `String must contain at least ${this._minLength} character(s)`,
        'string.min_length',
        path,
        { minLength: this._minLength, actual: value.length }
      ));
    }

    // Max length validation
    if (this._maxLength !== undefined && value.length > this._maxLength) {
      issues.push(this.issue(
        `String must contain at most ${this._maxLength} character(s)`,
        'string.max_length',
        path,
        { maxLength: this._maxLength, actual: value.length }
      ));
    }

    // Pattern validation
    if (this._pattern !== undefined && !this._pattern.test(value)) {
      issues.push(this.issue(
        `String must match pattern: ${this._pattern}`,
        'string.pattern',
        path,
        { pattern: this._pattern.toString() }
      ));
    }

    // Format validation
    if (this._format !== undefined) {
      const formatIssue = this._validateFormat(value, this._format, path);
      if (formatIssue) {
        issues.push(formatIssue);
      }
    }

    if (issues.length > 0) {
      return err(this.validationError(issues));
    }

    return ok(value);
  }

  /**
   * Validate string format (email, url, uuid, etc.)
   */
  private _validateFormat(value: string, format: StringFormat, path: string[]): ValidationIssue | null {
    switch (format) {
      case 'email':
        // Basic email regex - in a real library we'd use a more robust solution
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return this.issue(
            'Invalid email address',
            'string.email',
            path
          );
        }
        break;

      case 'url':
        try {
          new URL(value);
        } catch {
          return this.issue(
            'Invalid URL',
            'string.url',
            path
          );
        }
        break;

      case 'uuid':
        // UUID v4 regex
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
          return this.issue(
            'Invalid UUID',
            'string.uuid',
            path
          );
        }
        break;

      default:
        // Unknown format
        return this.issue(
          `Unsupported format: ${format}`,
          'string.format',
          path
        );
    }

    return null;
  }

  /**
   * Generate a partial schema
   * For primitives like string, partial means the value is now optional
   */
  partial(): Schema<string | undefined> {
    return this.optional();
  }
}


/**
 * Schema for optional string
 */
class OptionalStringSchema extends Schema<string | undefined> {
  constructor(private readonly baseSchema: StringSchema) {
    super();
  }
  
  /**
   * Parse and validate string data
   */
  _parse(data: unknown, options: ValidationOptions): Result<string | undefined, ValidationError> {
    if (data === undefined || data === null) {
      return ok(undefined);
    }
    
    return this.baseSchema._parse(data, options);
  }
  
  /**
   * Generate a partial schema
   */
  partial(): Schema<string | undefined> {
    return this;
  }
}

/**
 * String format types
 */
export type StringFormat = 'email' | 'url' | 'uuid' | 'date' | 'time' | 'datetime';

/**
 * Options for string schema
 */
export interface StringSchemaOptions {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  format?: StringFormat;
  trim?: boolean;
  optional?: boolean;
}

/**
 * Create a string schema
 */
export function string(options: StringSchemaOptions = {}): StringSchema {
  return new StringSchema(options);
}