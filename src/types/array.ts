import { Schema, ValidationOptions } from '../core/schema';
import { Result, ok, err } from '../core/result';
import { ValidationError, ValidationIssue } from '../core/errors';

/**
 * Schema for array validation
 */
export class ArraySchema<T> extends Schema<T[]> {
  private readonly _itemSchema: Schema<T>;
  private readonly _minItems?: number;
  private readonly _maxItems?: number;
  private readonly _uniqueItems: boolean = false;
  
  constructor(itemSchema: Schema<T>, options: ArraySchemaOptions = {}) {
    super();
    this._itemSchema = itemSchema;
    this._minItems = options.minItems;
    this._maxItems = options.maxItems;
    this._uniqueItems = options.uniqueItems || false;
  }
  
  /**
   * Set minimum items validation
   */
  min(count: number): ArraySchema<T> {
    return new ArraySchema(this._itemSchema, {
      ...this._getOptions(),
      minItems: count,
    });
  }
  
  /**
   * Set maximum items validation
   */
  max(count: number): ArraySchema<T> {
    return new ArraySchema(this._itemSchema, {
      ...this._getOptions(),
      maxItems: count,
    });
  }
  
  /**
   * Set uniqueness validation
   */
  unique(): ArraySchema<T> {
    return new ArraySchema(this._itemSchema, {
      ...this._getOptions(),
      uniqueItems: true,
    });
  }
  

  /**
   * Generate a partial schema
   * Pour les tableaux, nous devons gérer deux niveaux:
   * 1. Le tableau lui-même devient optionnel
   * 2. Les éléments du tableau sont rendus partiels
   */
  partial(): Schema<Partial<T[]>> {
    // Make the item schema partial if possible
    const partialItemSchema = this._itemSchema.partial() as Schema<Partial<T>>;
    
    // Pour les tableaux, Partial<T[]> signifie T[] | undefined
    // Donc nous créons un schéma de tableau optionnel avec des éléments partiels
    return new ArraySchema<Partial<T>>(partialItemSchema, this._getOptions()).optional() as Schema<(T | undefined)[]>;
  }

  /**
   * Make this array optional
   */
  optional(): Schema<T[] | undefined> {
    return new OptionalArraySchema<T>(this._itemSchema, this._getOptions());
  }
  
  /**
   * Internal method to get current options
   */
  private _getOptions(): ArraySchemaOptions {
    return {
      minItems: this._minItems,
      maxItems: this._maxItems,
      uniqueItems: this._uniqueItems,
    };
  }
  
  /**
   * Parse and validate array data
   */
  _parse(data: unknown, options: ValidationOptions): Result<T[], ValidationError> {
    const path = options.path || [];
    
    // Type check
    if (!Array.isArray(data)) {
      return err(ValidationError.typeMismatch('array', data, path));
    }
    
    const array = data;
    const issues: ValidationIssue[] = [];
    
    // Length validations
    if (this._minItems !== undefined && array.length < this._minItems) {
      issues.push(this.issue(
        `Array must contain at least ${this._minItems} item(s)`,
        'array.min_items',
        path,
        { minItems: this._minItems, actual: array.length }
      ));
    }
    
    if (this._maxItems !== undefined && array.length > this._maxItems) {
      issues.push(this.issue(
        `Array must contain at most ${this._maxItems} item(s)`,
        'array.max_items',
        path,
        { maxItems: this._maxItems, actual: array.length }
      ));
    }
    
    // Uniqueness validation
    if (this._uniqueItems && new Set(array).size !== array.length) {
      issues.push(this.issue(
        'Array items must be unique',
        'array.unique',
        path
      ));
    }
    
    // Abort early if needed
    if (options.abortEarly && issues.length > 0) {
      return err(this.validationError(issues));
    }
    
    // Validate each item in the array
    const result: T[] = [];
    
    for (let i = 0; i < array.length; i++) {
      const itemPath = [...path, i.toString()];
      const itemResult = this._itemSchema.safeParse(array[i], {
        ...options,
        path: itemPath,
      });
      
      if (itemResult.isOk()) {
        result.push(itemResult.unwrap());
      } else {
        issues.push(...itemResult.unwrapErr().issues);
        
        // Abort early if requested
        if (options.abortEarly && issues.length > 0) {
          break;
        }
      }
    }
    
    if (issues.length > 0) {
      return err(this.validationError(issues));
    }
    
    return ok(result);
  }
}


/**
 * Schema for optional arrays
 */
class OptionalArraySchema<T> extends Schema<T[] | undefined> {
  private readonly _arraySchema: ArraySchema<T>;
  
  constructor(itemSchema: Schema<T>, options: ArraySchemaOptions = {}) {
    super();
    this._arraySchema = new ArraySchema(itemSchema, options);
  }
  
  /**
   * Parse and validate array data
   */
  _parse(data: unknown, options: ValidationOptions): Result<T[] | undefined, ValidationError> {
    if (data === undefined || data === null) {
      return ok(undefined);
    }
    
    return this._arraySchema._parse(data, options);
  }
  
  /**
   * Generate a partial schema
   */
  partial(): Schema<Partial<T[] | undefined>> {
    // Pour les tableaux optionnels, Partial<T[] | undefined> signifie le même type
    return this;
  }
}

/**
 * Options for array schema
 */
export interface ArraySchemaOptions {
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

/**
 * Create an array schema
 */
export function array<T>(itemSchema: Schema<T>, options: ArraySchemaOptions = {}): ArraySchema<T> {
  return new ArraySchema(itemSchema, options);
}