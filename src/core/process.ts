import { Schema, ValidationOptions } from './schema';
import { Result, ok, err } from './result';
import { ValidationError } from './errors';

/**
 * Schema with preprocessing capabilities
 */
export class PreprocessSchema<T> extends Schema<T> {
  constructor(
    private readonly baseSchema: Schema<T>,
    private readonly preprocessor: (value: unknown) => unknown
  ) {
    super();
  }

  /**
   * Internal parse method
   */
  _parse(data: unknown, options: ValidationOptions): Result<T, ValidationError> {
    const processedData = this.preprocessor(data);
    return this.baseSchema._parse(processedData, options);
  }
  
  /**
   * Generate a partial schema
   */
  partial(): Schema<any> {
    // Create a partial version of the base schema
    const partialBase = this.baseSchema.partial();
    
    // Apply the same preprocessing to the partial schema
    return new PreprocessSchema(
      partialBase,
      this.preprocessor
    );
  }
}

/**
 * Schema with postprocessing capabilities
 */
export class PostprocessSchema<T, U> extends Schema<U> {
  constructor(
    private readonly baseSchema: Schema<T>,
    private readonly postprocessor: (value: T) => U
  ) {
    super();
  }

  /**
   * Internal parse method
   */
  _parse(data: unknown, options: ValidationOptions): Result<U, ValidationError> {
    const baseResult = this.baseSchema._parse(data, options);

    if (baseResult.isErr()) {
      return err(baseResult.unwrapErr());
    }

    // Apply postprocessing
    try {
      const processedData = this.postprocessor(baseResult.unwrap());
      return ok(processedData);
    } catch (error) {
      return err(new ValidationError([
        {
          path: options.path || [],
          message: `Postprocessing failed: ${error instanceof Error ? error.message : String(error)}`,
          code: 'process.postprocess_failed',
        }
      ]));
    }
  }
  
  /**
   * Generate a partial schema
   */
  partial(): Schema<any> {
    // Create a partial version of the base schema
    const partialBase = this.baseSchema.partial();
    
    // Apply the same postprocessing to the partial schema
    return new PostprocessSchema(
      partialBase,
      this.postprocessor
    );
  }
}

/**
 * Helper for creating preprocess schemas
 */
export function preprocess<T>(
  schema: Schema<T>,
  preprocessor: (value: unknown) => unknown
): PreprocessSchema<T> {
  return new PreprocessSchema(schema, preprocessor);
}

/**
 * Helper for creating postprocess schemas
 */
export function postprocess<T, U>(
  schema: Schema<T>,
  postprocessor: (value: T) => U
): PostprocessSchema<T, U> {
  return new PostprocessSchema(schema, postprocessor);
}