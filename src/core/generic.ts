import { Schema } from './schema';

/**
 * Create a generic API response schema.
 * 
 * This is a common pattern where an API returns a structure like:
 * {
 *   success: boolean,
 *   data: T,
 *   error?: string
 * }
 */
export function createApiResponseSchema<T extends Schema<any>>(
  dataSchema: T
): Schema<{
  success: boolean;
  data: T extends Schema<infer U> ? U : any;
  error?: string;
}> {
  const { s } = require('../index');
  
  return s.object({
    success: s.boolean(),
    data: dataSchema,
    error: s.string().optional(),
  });
}

/**
 * Create a generic paginated response schema
 */
export function createPaginatedSchema<T extends Schema<any>>(
  itemSchema: T
): Schema<{
  items: Array<T extends Schema<infer U> ? U : any>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const { s } = require('../index');
  
  return s.object({
    items: s.array(itemSchema),
    total: s.number().int().min(0),
    page: s.number().int().min(1),
    pageSize: s.number().int().min(1),
    totalPages: s.number().int().min(0),
  });
}

/**
 * Create a generic record schema (dictionary)
 */
export function createRecordSchema<K extends Schema<string>, V extends Schema<any>>(
  keySchema: K,
  valueSchema: V
): Schema<Record<
  K extends Schema<infer KT> ? KT extends string ? KT : string : string,
  V extends Schema<infer VT> ? VT : any
>> {
  const { s } = require('../index');
  
  return s.custom((value: unknown) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return s.error(new Error('Expected an object'));
    }
    
    const result: Record<string, any> = {};
    const errors: ValidationIssue[] = [];
    
    for (const [key, val] of Object.entries(value)) {
      // Validate key
      const keyResult = keySchema.safeParse(key);
      if (keyResult.isErr()) {
        errors.push({
          path: [key],
          message: `Invalid key: ${keyResult.unwrapErr().message}`,
          code: 'record.invalid_key',
        });
        continue;
      }
      
      // Validate value
      const valueResult = valueSchema.safeParse(val);
      if (valueResult.isErr()) {
        errors.push(...valueResult.unwrapErr().issues.map(issue => ({
          ...issue,
          path: [key, ...issue.path],
        })));
        continue;
      }
      
      // Add to result
      result[key] = valueResult.unwrap();
    }
    
    if (errors.length > 0) {
      return s.error(new ValidationError(errors));
    }
    
    return s.ok(result);
  });
}

/**
 * Create a generic union schema
 */
export function createUnionSchema<T extends Schema<any>[]>(
  schemas: [...T]
): Schema<T[number] extends Schema<infer U> ? U : never> {
  const { s } = require('../index');
  
  return s.custom((value: unknown) => {
    const errors: ValidationError[] = [];
    
    // Try each schema
    for (const schema of schemas) {
      const result = schema.safeParse(value);
      
      if (result.isOk()) {
        return result;
      }
      
      errors.push(result.unwrapErr());
    }
    
    // If all schemas failed, combine errors
    const allIssues = errors.flatMap(err => err.issues);
    return s.error(new ValidationError(allIssues));
  });
}

/**
 * Create a generic intersection schema
 */
export function createIntersectionSchema<
  A extends Schema<Record<string, any>>,
  B extends Schema<Record<string, any>>
>(schemaA: A, schemaB: B): Schema<
  A extends Schema<infer AU> ? 
    B extends Schema<infer BU> ? 
      AU & BU : 
      AU : 
    B extends Schema<infer BU> ? 
      BU : 
      never
> {
  const { s } = require('../index');
  
  return s.custom((value: unknown) => {
    // Validate with first schema
    const resultA = schemaA.safeParse(value);
    if (resultA.isErr()) {
      return resultA;
    }
    
    // Validate with second schema
    const resultB = schemaB.safeParse(value);
    if (resultB.isErr()) {
      return resultB;
    }
    
    // Merge results
    const merged = {
      ...resultA.unwrap(),
      ...resultB.unwrap(),
    };
    
    return s.ok(merged);
  });
}

/**
 * Create a discriminated union schema
 */
export function createDiscriminatedUnionSchema<
  D extends string,
  S extends Array<Schema<{ [K in D]: any }>>
>(discriminator: D, schemas: [...S]): Schema<S[number] extends Schema<infer U> ? U : never> {
  const { s } = require('../index');
  
  return s.custom((value: unknown) => {
    if (typeof value !== 'object' || value === null) {
      return s.error(new Error(`Expected an object with '${discriminator}' property`));
    }
    
    // Check for discriminator
    const obj = value as Record<string, any>;
    if (!(discriminator in obj)) {
      return s.error(new Error(`Missing discriminator property '${discriminator}'`));
    }
    
    const discriminatorValue = obj[discriminator];
    
    // Find matching schema
    for (const schema of schemas) {
      const result = schema.safeParse(value);
      if (result.isOk()) {
        const validatedObj = result.unwrap();
        // Check that the discriminator value matches
        if (validatedObj[discriminator] === discriminatorValue) {
          return result;
        }
      }
    }
    
    return s.error(new Error(`No matching schema found for discriminator value '${discriminatorValue}'`));
  });
}

/**
 * Create a lazy schema (for recursive types)
 */
export function createLazySchema<T>(schemaFn: () => Schema<T>): Schema<T> {
  const { s } = require('../index');
  
  let cachedSchema: Schema<T> | null = null;
  
  return s.custom((value: unknown) => {
    if (!cachedSchema) {
      cachedSchema = schemaFn();
    }
    
    return cachedSchema.safeParse(value);
  });
}

// Needed for the record schema implementation
import { ValidationError, ValidationIssue } from './errors';