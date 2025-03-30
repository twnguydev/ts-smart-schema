import { Schema, ValidationOptions } from './schema';
import { Result, ok, err, Ok, Err } from './result';
import { ValidationError } from './errors';

/**
 * Schema with asynchronous validation
 */
export class AsyncSchema<T> extends Schema<T> {
  constructor(
    private readonly baseSchema: Schema<T>,
    private readonly asyncValidator: (value: T) => Promise<Result<T, ValidationError>>
  ) {
    super();
  }

  /**
   * Internal parse method
   * Note: This won't actually perform async validation since _parse is synchronous
   * Async validation must be done using parseAsync instead
   */
  _parse(data: unknown, options: ValidationOptions): Result<T, ValidationError> {
    // Just validate with base schema synchronously
    return this.baseSchema._parse(data, options);
  }
  
  /**
   * Parse and validate input data asynchronously
   */
  async parseAsync(data: unknown, options: ValidationOptions = {}): Promise<T> {
    // First validate with base schema
    const baseResult = this.baseSchema.safeParse(data, options);

    if (baseResult.isErr()) {
      throw baseResult.unwrapErr();
    }

    // Then perform async validation
    const asyncResult = await this.asyncValidator(baseResult.unwrap());

    if (typeof asyncResult === 'boolean') {
      if (!asyncResult) {
        throw new ValidationError([{
          path: options.path || [],
          message: 'Async validation failed',
          code: 'async.failed'
        }]);
      }
      return baseResult.unwrap();
    } else if (asyncResult === undefined || asyncResult === null) {
      return baseResult.unwrap();
    } else if (asyncResult && typeof asyncResult === 'object' && '_tag' in asyncResult) {
      // It's a Result object
      if (asyncResult._tag === 'Err') {
        throw (asyncResult as Err<any, ValidationError>).unwrapErr();
      }
      return (asyncResult as Ok<T, ValidationError>).unwrap();
    }

    // Fallback for other cases
    return baseResult.unwrap();
  }
  
  /**
   * Safely parse and validate input data asynchronously
   */
  async safeParseAsync(data: unknown, options: ValidationOptions = {}): Promise<Result<T, ValidationError>> {
    try {
      // First validate with base schema
      const baseResult = this.baseSchema.safeParse(data, options);
      
      if (baseResult.isErr()) {
        return baseResult;
      }
      
      // Then perform async validation
      return await this.asyncValidator(baseResult.unwrap());
    } catch (error) {
      return err(
        error instanceof ValidationError
          ? error
          : new ValidationError([
              {
                path: options.path || [],
                message: `Async validation failed: ${error instanceof Error ? error.message : String(error)}`,
                code: 'async.failed',
              },
            ])
      );
    }
  }
  
  /**
   * Generate a partial schema
   */
  partial(): Schema<any> {
    // Create a partial version of the base schema
    const partialBase = this.baseSchema.partial();
    
    // Apply the same async validation to the partial schema
    return new AsyncSchema(
      partialBase,
      this.asyncValidator as any
    );
  }
}

/**
 * Create a schema with asynchronous validation
 */
export function asyncValidate<T>(
  schema: Schema<T>,
  validator: (value: T) => Promise<boolean | Result<T, ValidationError> | void>,
  errorMessage?: string
): AsyncSchema<T> {
  // Convert simple validators to result validators
  const resultValidator = async (value: T): Promise<Result<T, ValidationError>> => {
    try {
      const validationResult = await validator(value);
      
      // If the validator returns a boolean
      if (typeof validationResult === 'boolean') {
        return validationResult
          ? ok(value)
          : err(
              new ValidationError([
                {
                  path: [],
                  message: errorMessage || 'Async validation failed',
                  code: 'async.failed',
                },
              ])
            );
      }
      
      // If the validator returns void or undefined, assume success
      if (validationResult === undefined) {
        return ok(value);
      }
      
      // If the validator returns a Result, use it directly
      return validationResult as Result<T, ValidationError>;
    } catch (error) {
      return err(
        new ValidationError([
          {
            path: [],
            message: `Async validation error: ${error instanceof Error ? error.message : String(error)}`,
            code: 'async.error',
          },
        ])
      );
    }
  };
  
  return new AsyncSchema(schema, resultValidator);
}