import { Schema, ValidationOptions, PartialSchema } from '../core/schema';
import { Result, ok, err } from '../core/result';
import { ValidationError, ValidationIssue } from '../core/errors';

/**
 * Type helper to extract schema types from a shape object
 */
export type InferObjectType<S extends Record<string, Schema<any>>> = {
  [K in keyof S]: S[K] extends Schema<infer T> ? T : never;
};

/**
 * Schema for object validation
 */
export class ObjectSchema<T extends Record<string, any>> extends Schema<T> {
  private readonly _shape: Record<string, Schema<any>>;
  private readonly _required: Set<string>;
  private readonly _defaults: Record<string, any>;

  constructor(options: ObjectSchemaOptions<T>) {
    super();
    this._shape = options.shape || {};
    this._required = new Set(options.required || Object.keys(this._shape));
    this._defaults = options.defaults || {} as Partial<T>;
  }

  /**
   * Make specific properties required
   */
  required<K extends keyof T>(keys: K | K[]): ObjectSchema<T> {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    const required = new Set(this._required);

    for (const key of keysArray) {
      required.add(key as string);
    }

    return new ObjectSchema<T>({
      shape: this._shape,
      required: Array.from(required),
      defaults: this._defaults,
    });
  }

  /**
   * Set default values for properties
   */
  default<K extends keyof T>(key: K, value: T[K]): ObjectSchema<T> {
    return new ObjectSchema<T>({
      shape: this._shape,
      required: Array.from(this._required),
      defaults: {
        ...this._defaults,
        [key]: value,
      },
    });
  }

  /**
   * Generate a partial schema where all properties are optional
   */
  partial(): PartialSchema<T> {
    const shape = this._shape;
    const defaults = this._defaults;

    const partialSchema = new ObjectSchema<Partial<T>>({
      shape: shape,
      required: [], // No required fields
      defaults: defaults,
    });

    return Object.assign(partialSchema, {
      required<K extends keyof T>(keys: K | K[]): PartialSchema<T> {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        const required = new Set<string>();

        for (const key of keysArray) {
          required.add(key as string);
        }

        const newPartialSchema = new ObjectSchema<Partial<T>>({
          shape: shape,
          required: Array.from(required),
          defaults: defaults,
        });

        return Object.assign(newPartialSchema, {
          required: function <K extends keyof T>(keys: K | K[]): PartialSchema<T> {
            const keysArray = Array.isArray(keys) ? keys : [keys];
            const newRequired = new Set(required);

            for (const key of keysArray) {
              newRequired.add(key as string);
            }

            return new ObjectSchema<Partial<T>>({
              shape: shape,
              required: Array.from(newRequired),
              defaults: defaults,
            }) as PartialSchema<T>;
          }
        }) as PartialSchema<T>;
      }
    }) as PartialSchema<T>;
  }

  /**
   * Make the entire object or specific properties optional
   * @param keys - If provided, makes only these properties optional
   * @returns A new schema with optional properties or an optional object
   */
  optional<K extends keyof T>(keys?: K | K[]): Schema<T | undefined> | ObjectSchema<T> {
    if (keys === undefined) {
      return new OptionalObjectSchema<T>(this);
    }

    const keysArray: K[] = Array.isArray(keys) ? keys : [keys];
    const required = new Set(this._required);

    for (const key of keysArray) {
      required.delete(key as string);
    }

    return new ObjectSchema<T>({
      shape: this._shape,
      required: Array.from(required),
      defaults: this._defaults,
    });
  }

  /**
   * Parse and validate object data
   */
  _parse(data: unknown, options: ValidationOptions): Result<T, ValidationError> {
    const path = options.path || [];

    // Type check
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return err(ValidationError.typeMismatch('object', data, path));
    }

    const value = data as Record<string, unknown>;
    const result: Record<string, any> = {};
    const issues: ValidationIssue[] = [];

    // Apply defaults if enabled in options
    const useDefaults = options.defaults !== false;

    // Validate each property in the shape
    for (const [key, schema] of Object.entries(this._shape)) {
      const propPath = [...path, key];

      if (key in value) {
        // Validate existing property
        const propResult = schema.safeParse(value[key], {
          ...options,
          path: propPath,
        });

        if (propResult.isOk()) {
          result[key] = propResult.unwrap();
        } else {
          issues.push(...propResult.unwrapErr().issues);

          // Abort early if requested
          if (options.abortEarly && issues.length > 0) {
            return err(this.validationError(issues));
          }
        }
      } else if (this._required.has(key)) {
        // Missing required property
        issues.push(this.issue(
          `Required property missing`,
          'object.required',
          propPath
        ));

        // Abort early if requested
        if (options.abortEarly && issues.length > 0) {
          return err(this.validationError(issues));
        }
      } else if (useDefaults && key in this._defaults) {
        // Apply default value
        result[key] = this._defaults[key];
      }
    }

    // Check for unknown properties if not stripping them
    if (!options.stripUnknown) {
      for (const key of Object.keys(value)) {
        if (!(key in this._shape)) {
          result[key] = value[key];
        }
      }
    } else {
      // Only include known properties when stripUnknown is true
      for (const key of Object.keys(value)) {
        if (key in this._shape) {
          if (!(key in result)) {
            result[key] = value[key];
          }
        }
      }
    }

    if (issues.length > 0) {
      return err(this.validationError(issues));
    }

    return ok(result as T);
  }
}

/**
 * Schema for optional objects
 */
class OptionalObjectSchema<T extends Record<string, any>> extends Schema<T | undefined> {
  constructor(private readonly baseSchema: ObjectSchema<T>) {
    super();
  }
  
  /**
   * Parse and validate object data
   */
  _parse(data: unknown, options: ValidationOptions): Result<T | undefined, ValidationError> {
    if (data === undefined || data === null) {
      return ok(undefined);
    }
    
    return this.baseSchema._parse(data, options);
  }
  
  /**
   * Generate a partial schema
   */
  partial(): Schema<Partial<T> | undefined> {
    // Return a partial schema that can also be undefined
    return new OptionalObjectSchema(this.baseSchema.partial() as ObjectSchema<Partial<T>>);
  }
}

/**
 * Options for object schema
 */
export interface ObjectSchemaOptions<T extends Record<string, any>> {
  shape?: Record<string, Schema<any>>;
  required?: string[];
  defaults?: Partial<T> | Record<string, any>;
}

/**
 * Create an object schema
 */
export function object<S extends Record<string, Schema<any>>>(
  shape: S
): ObjectSchema<InferObjectType<S>> {
  return new ObjectSchema({
    shape,
    required: Object.keys(shape),
  });
}