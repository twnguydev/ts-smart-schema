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
  private readonly _defaultValue?: T[];
  
  constructor(itemSchema: Schema<T>, options: ArraySchemaOptions = {}) {
    super();
    this._itemSchema = itemSchema;
    this._minItems = options.minItems;
    this._maxItems = options.maxItems;
    this._uniqueItems = options.uniqueItems || false;
    this._defaultValue = options.default as T[] | undefined;
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
   * Set a default value for when the array is undefined
   */
  default(defaultValue: T[]): ArraySchema<T> {
    return new ArraySchema(this._itemSchema, {
      ...this._getOptions(),
      default: [...defaultValue], // Copie pour éviter les références partagées
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
      default: this._defaultValue,
    };
  }
  
  /**
   * Parse and validate array data
   */
  _parse(data: unknown, options: ValidationOptions): Result<T[], ValidationError> {
    const path = options.path || [];

    // Handle undefined with default value
    if (data === undefined) {
      if (this._defaultValue !== undefined) {
        return ok([...this._defaultValue]); // Retourner une copie de la valeur par défaut
      }

      return err(ValidationError.typeMismatch('array', data, path));
    }

    // Handle null (si vous voulez traiter null comme undefined)
    if (data === null) {
      if (this._defaultValue !== undefined) {
        return ok([...this._defaultValue]);
      }

      return err(ValidationError.typeMismatch('array', data, path));
    }

    // Type check
    if (!Array.isArray(data)) {
      return err(ValidationError.typeMismatch('array', data, path));
    }

    const arr = data as unknown[];
    const result: T[] = [];
    const issues: ValidationIssue[] = [];

    // Length validations
    if (this._minItems !== undefined && arr.length < this._minItems) {
      issues.push(this.issue(
        `Array must contain at least ${this._minItems} item(s)`,
        'array.min_length',
        path,
        { min: this._minItems, actual: arr.length }
      ));
    }

    if (this._maxItems !== undefined && arr.length > this._maxItems) {
      issues.push(this.issue(
        `Array must contain at most ${this._maxItems} item(s)`,
        'array.max_length',
        path,
        { max: this._maxItems, actual: arr.length }
      ));
    }

    // Uniqueness validation
    if (this._uniqueItems && arr.length > 1) {
      const seen = new Set();
      const duplicates = [];

      for (let i = 0; i < arr.length; i++) {
        // Pour les types primitifs, nous pouvons utiliser Set directement
        if (typeof arr[i] === 'string' || typeof arr[i] === 'number' || typeof arr[i] === 'boolean') {
          if (seen.has(arr[i])) {
            duplicates.push(i);
          } else {
            seen.add(arr[i]);
          }
        } else {
          // Pour les objets, nous devrions utiliser une méthode d'égalité plus sophistiquée
          // mais pour les tests de base, utilisons la sérialisation JSON
          const strValue = JSON.stringify(arr[i]);
          if (seen.has(strValue)) {
            duplicates.push(i);
          } else {
            seen.add(strValue);
          }
        }
      }

      if (duplicates.length > 0) {
        issues.push(this.issue(
          `Array items must be unique, found duplicates at positions: ${duplicates.join(', ')}`,
          'array.unique',
          path,
          { duplicates }
        ));
      }
    }

    // Validate items
    for (let i = 0; i < arr.length; i++) {
      const itemPath = [...path, i.toString()];
      const itemResult = this._itemSchema.safeParse(arr[i], {
        ...options,
        path: itemPath,
      });

      if (itemResult.isOk()) {
        result.push(itemResult.unwrap());
      } else {
        issues.push(...itemResult.unwrapErr().issues);

        if (options.abortEarly) {
          return err(this.validationError(issues));
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
export interface ArraySchemaOptions<T = unknown> {
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  default?: T[];
  stripUnknown?: boolean;
}

/**
 * Create an array schema
 */
export function array<T>(itemSchema: Schema<T>, options: ArraySchemaOptions = {}): ArraySchema<T> {
  return new ArraySchema(itemSchema, options);
}