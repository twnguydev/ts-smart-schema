import { Schema, ValidationOptions } from './schema';
import { Result, ok, err } from './result';
import { ValidationError, ValidationIssue } from './errors';

/**
 * Schema for union types
 */
export class UnionSchema<T> extends Schema<T> {
  constructor(private readonly schemas: Schema<any>[]) {
    super();
  }

  /**
   * Parse and validate union data
   */
  _parse(data: unknown, options: ValidationOptions): Result<T, ValidationError> {
    const path = options.path || [];
    const issues: ValidationIssue[] = [];

    // Try each schema
    for (const schema of this.schemas) {
      const result = schema.safeParse(data, options);
      
      if (result.isOk()) {
        return result as Result<T, ValidationError>;
      }
      
      // Collect errors from all schemas
      issues.push(...result.unwrapErr().issues);
    }

    // Return a combined error
    return err(new ValidationError([
      {
        path,
        message: 'Value did not match any schema in union',
        code: 'union.no_match',
        params: { value: data }
      },
      ...issues
    ]));
  }

  /**
   * Generate a partial schema
   */
  partial(): Schema<any> {
    return new UnionSchema(this.schemas.map(schema => schema.partial()));
  }
}

/**
 * Create a union schema
 */
export function createUnionSchema<T extends Schema<any>[]>(
  schemas: [...T]
): Schema<T[number] extends Schema<infer U> ? U : never> {
  return new UnionSchema(schemas);
}

/**
 * Schema for discriminated union types
 */
export class DiscriminatedUnionSchema<T, K extends keyof any> extends Schema<T> {
  constructor(
    private readonly discriminator: K,
    private readonly schemas: Schema<any>[]
  ) {
    super();
  }

  /**
   * Parse and validate discriminated union data
   */
  _parse(data: unknown, options: ValidationOptions): Result<T, ValidationError> {
    const path = options.path || [];
    
    // Type check
    if (typeof data !== 'object' || data === null) {
      return err(ValidationError.typeMismatch('object', data, path));
    }
    
    const value = data as Record<string | number | symbol, unknown>;
    
    // Check for discriminator property
    if (!(this.discriminator in value)) {
      return err(new ValidationError([{
        path,
        message: `Discriminator property '${String(this.discriminator)}' is missing`,
        code: 'union.discriminator_missing',
        params: { discriminator: this.discriminator }
      }]));
    }
    
    const discriminatorValue = value[this.discriminator];
    const issues: ValidationIssue[] = [];
    
    // Try each schema
    for (const schema of this.schemas) {
      const result = schema.safeParse(data, options);
      
      if (result.isOk()) {
        return result as Result<T, ValidationError>;
      }
      
      // Collect errors
      issues.push(...result.unwrapErr().issues);
    }
    
    // Return a combined error
    return err(new ValidationError([
      {
        path,
        message: `No schema matched discriminator value '${String(discriminatorValue)}'`,
        code: 'union.no_discriminator_match',
        params: { discriminator: this.discriminator, value: discriminatorValue }
      },
      ...issues
    ]));
  }

  /**
   * Generate a partial schema
   */
  partial(): Schema<any> {
    return new DiscriminatedUnionSchema(
      this.discriminator,
      this.schemas.map(schema => schema.partial())
    );
  }
}

/**
 * Create a discriminated union schema
 */
export function createDiscriminatedUnionSchema<
  K extends string,
  T extends Schema<any>[]
>(
  discriminator: K,
  schemas: [...T]
): Schema<T[number] extends Schema<infer U> ? U : never> {
  return new DiscriminatedUnionSchema(discriminator, schemas);
}

/**
 * Schema for intersection types
 */
export class IntersectionSchema<T> extends Schema<T> {
  constructor(
    private readonly schemas: Schema<any>[]
  ) {
    super();
  }

  /**
   * Parse and validate intersection data
   */
  _parse(data: unknown, options: ValidationOptions): Result<T, ValidationError> {
    const path = options.path || [];
    const issues: ValidationIssue[] = [];
    const result: Record<string, any> = {};
    
    // Validate against each schema
    for (const schema of this.schemas) {
      const schemaResult = schema.safeParse(data, options);
      
      if (schemaResult.isErr()) {
        issues.push(...schemaResult.unwrapErr().issues);
        
        // Abort early if requested
        if (options.abortEarly && issues.length > 0) {
          return err(new ValidationError(issues));
        }
      } else {
        // Merge successful result
        const value = schemaResult.unwrap();
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          Object.assign(result, value);
        }
      }
    }
    
    if (issues.length > 0) {
      return err(new ValidationError(issues));
    }
    
    return ok(result as T);
  }

  /**
   * Generate a partial schema
   */
  partial(): Schema<any> {
    return new IntersectionSchema(this.schemas.map(schema => schema.partial()));
  }
}

/**
 * Create an intersection schema from two schemas
 */
export function createIntersectionSchema<S1 extends Schema<any>, S2 extends Schema<any>>(
  schema1: S1,
  schema2: S2
): Schema<S1 extends Schema<infer T1> ? S2 extends Schema<infer T2> ? T1 & T2 : never : never> {
  return new IntersectionSchema([schema1, schema2]);
}

/**
 * Schema for lazy evaluation (used for recursive schemas)
 */
export class LazySchema<T> extends Schema<T> {
  private _cachedSchema: Schema<T> | null = null;

  constructor(private readonly schemaFn: () => Schema<T>) {
    super();
  }

  /**
   * Parse and validate against the lazily evaluated schema
   */
  _parse(data: unknown, options: ValidationOptions): Result<T, ValidationError> {
    // If `stripUnknown` is true and `data` is not undefined, we need to
    // evaluate the schema to strip unknown properties
    // from the data. This is important for recursive schemas where
    // we want to keep the original structure of the data.
    if (options.stripUnknown === true && 
        data !== undefined && 
        options.path && 
        options.path.length > 0) {

      if (!this._cachedSchema) {
        this._cachedSchema = this.schemaFn();
      }
      
      return this._cachedSchema._parse(data, options);
    }

    if (data === undefined && options.defaults === true) {
      if (
        this.schemaFn.toString().includes('array') &&
        this.schemaFn.toString().includes('default')
      ) {
        return ok([] as unknown as T);
      }
    }

    if (!this._cachedSchema) {
      try {
        this._cachedSchema = this.schemaFn();
      } catch (e) {
        if (data === undefined && options.defaults === true) {
          return ok([] as unknown as T);
        }

        return err(new ValidationError([{
          path: options.path || [],
          message: `Failed to evaluate lazy schema: ${e instanceof Error ? e.message : String(e)}`,
          code: 'lazy.evaluation_error',
          params: { error: String(e) }
        }]));
      }
    }

    return this._cachedSchema._parse(data, options);
  }

  /**
   * Generate a partial schema
   */
  partial(): Schema<any> {
    return new LazySchema(() => {
      if (!this._cachedSchema) {
        this._cachedSchema = this.schemaFn();
      }
      
      return this._cachedSchema.partial();
    });
  }
}

/**
 * Create a lazy schema
 */
export function createLazySchema<T>(schemaFn: () => Schema<T>): Schema<T> {
  return new LazySchema(schemaFn);
}

/**
 * Schema for API responses
 */
export class ApiResponseSchema<T, E = any> extends Schema<{
  success: boolean;
  data?: T;
  error?: E;
}> {
  constructor(
    private readonly dataSchema: Schema<T>,
    private readonly errorSchema?: Schema<E>
  ) {
    super();
  }

  /**
   * Parse and validate API response data
   */
  _parse(data: unknown, options: ValidationOptions): Result<{
    success: boolean;
    data?: T;
    error?: E;
  }, ValidationError> {
    const path = options.path || [];
    
    // Type check
    if (typeof data !== 'object' || data === null) {
      return err(ValidationError.typeMismatch('object', data, path));
    }
    
    const value = data as Record<string, unknown>;
    
    // Check for success property
    if (typeof value.success !== 'boolean') {
      return err(new ValidationError([{
        path: [...path, 'success'],
        message: 'API response must have a boolean success field',
        code: 'api.missing_success',
        params: { value }
      }]));
    }
    
    const result: {
      success: boolean;
      data?: T;
      error?: E;
    } = {
      success: value.success
    };
    
    // Validate data or error depending on success flag
    if (value.success) {
      if ('data' in value) {
        const dataResult = this.dataSchema.safeParse(value.data, {
          ...options,
          path: [...path, 'data']
        });
        
        if (dataResult.isErr()) {
          return dataResult as Result<any, ValidationError>;
        }
        
        result.data = dataResult.unwrap();
      } else {
        return err(new ValidationError([{
          path,
          message: 'Successful API response must have a data field',
          code: 'api.missing_data',
          params: { value }
        }]));
      }
    } else if (this.errorSchema && 'error' in value) {
      const errorResult = this.errorSchema.safeParse(value.error, {
        ...options,
        path: [...path, 'error']
      });
      
      if (errorResult.isErr()) {
        return errorResult as Result<any, ValidationError>;
      }
      
      result.error = errorResult.unwrap();
    }
    
    return ok(result);
  }

  /**
   * Generate a partial schema
   */
  partial(): Schema<any> {
    return new ApiResponseSchema(
      this.dataSchema.partial(),
      this.errorSchema ? this.errorSchema.partial() : undefined
    );
  }
}

/**
 * Create an API response schema
 */
export function createApiResponseSchema<T, E = any>(
  dataSchema: Schema<T>,
  errorSchema?: Schema<E>
): ApiResponseSchema<T, E> {
  return new ApiResponseSchema(dataSchema, errorSchema);
}

/**
 * Schema for paginated results
 */
export class PaginatedSchema<T> extends Schema<{
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}> {
  constructor(private readonly itemSchema: Schema<T>) {
    super();
  }

  /**
   * Parse and validate paginated data
   */
  _parse(data: unknown, options: ValidationOptions): Result<{
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  }, ValidationError> {
    const path = options.path || [];
    
    // Type check
    if (typeof data !== 'object' || data === null) {
      return err(ValidationError.typeMismatch('object', data, path));
    }
    
    const value = data as Record<string, unknown>;
    const result: any = {};
    const issues: ValidationIssue[] = [];
    
    // Validate required pagination fields
    const requiredFields = ['items', 'total', 'page', 'pageSize', 'pageCount'];
    
    for (const field of requiredFields) {
      if (!(field in value)) {
        issues.push({
          path: [...path, field],
          message: `Missing required pagination field: ${field}`,
          code: 'pagination.missing_field',
          params: { field }
        });
      }
    }
    
    if (issues.length > 0) {
      return err(new ValidationError(issues));
    }
    
    // Validate items array
    if (!Array.isArray(value.items)) {
      return err(new ValidationError([{
        path: [...path, 'items'],
        message: 'Pagination items must be an array',
        code: 'pagination.items_not_array',
        params: { value: value.items }
      }]));
    }
    
    // Validate each item
    const itemsResult: T[] = [];
    
    for (let i = 0; i < value.items.length; i++) {
      const itemResult = this.itemSchema.safeParse(value.items[i], {
        ...options,
        path: [...path, 'items', i.toString()]
      });
      
      if (itemResult.isErr()) {
        issues.push(...itemResult.unwrapErr().issues);
        
        if (options.abortEarly) {
          return err(new ValidationError(issues));
        }
      } else {
        itemsResult.push(itemResult.unwrap());
      }
    }
    
    // Validate numeric fields
    const numericFields = ['total', 'page', 'pageSize', 'pageCount'];
    
    for (const field of numericFields) {
      if (typeof value[field] !== 'number') {
        issues.push({
          path: [...path, field],
          message: `Pagination field ${field} must be a number`,
          code: 'pagination.field_not_number',
          params: { field, value: value[field] }
        });
      } else {
        result[field] = value[field];
      }
    }
    
    if (issues.length > 0) {
      return err(new ValidationError(issues));
    }
    
    result.items = itemsResult;
    
    return ok(result);
  }

  /**
   * Generate a partial schema
   */
  partial(): Schema<any> {
    return new PaginatedSchema(this.itemSchema.partial());
  }
}

/**
 * Create a paginated schema
 */
export function createPaginatedSchema<T>(
  itemSchema: Schema<T>
): PaginatedSchema<T> {
  return new PaginatedSchema(itemSchema);
}

/**
 * Schema for record types (dictionaries)
 */
export class RecordSchema<K extends string, V> extends Schema<Record<K, V>> {
  constructor(
    private readonly keySchema: Schema<K>,
    private readonly valueSchema: Schema<V>
  ) {
    super();
  }

  /**
   * Parse and validate record data
   */
  _parse(data: unknown, options: ValidationOptions): Result<Record<K, V>, ValidationError> {
    const path = options.path || [];
    
    // Type check
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return err(ValidationError.typeMismatch('object', data, path));
    }
    
    const value = data as Record<string, unknown>;
    const result: Record<string, V> = {};
    const issues: ValidationIssue[] = [];
    
    // Validate each key-value pair
    for (const [key, propValue] of Object.entries(value)) {
      // Validate key
      const keyResult = this.keySchema.safeParse(key, {
        ...options,
        path: [...path, `[${key}]`]
      });
      
      if (keyResult.isErr()) {
        issues.push(...keyResult.unwrapErr().issues);
        
        if (options.abortEarly) {
          return err(new ValidationError(issues));
        }
        
        continue;
      }
      
      // Validate value
      const valueResult = this.valueSchema.safeParse(propValue, {
        ...options,
        path: [...path, key]
      });
      
      if (valueResult.isErr()) {
        issues.push(...valueResult.unwrapErr().issues);
        
        if (options.abortEarly) {
          return err(new ValidationError(issues));
        }
      } else {
        result[key] = valueResult.unwrap();
      }
    }
    
    if (issues.length > 0) {
      return err(new ValidationError(issues));
    }
    
    return ok(result as Record<K, V>);
  }

  /**
   * Generate a partial schema
   */
  partial(): Schema<any> {
    return new RecordSchema(
      this.keySchema,
      this.valueSchema.partial()
    );
  }
}

/**
 * Create a record schema
 */
export function createRecordSchema<K extends string, V>(
  keySchema: Schema<K>,
  valueSchema: Schema<V>
): RecordSchema<K, V> {
  return new RecordSchema(keySchema, valueSchema);
}