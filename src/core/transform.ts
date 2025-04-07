import { Schema, ValidationOptions } from './schema';
import { Result, ok, err } from './result';
import { ValidationError } from './errors';

/**
 * Schema with transformation capabilities
 */
export class TransformSchema<TInput, TOutput> extends Schema<TOutput> {
  constructor(
    private readonly baseSchema: Schema<TInput>,
    private readonly transformer: (value: TInput) => TOutput | Result<TOutput, ValidationError>,
    private readonly reverseTransformer?: (value: TOutput) => TInput | Result<TInput, ValidationError>
  ) {
    super();
  }

  /**
   * Internal parse method
   */
  _parse(data: unknown, options: ValidationOptions): Result<TOutput, ValidationError> {
    // First, validate with base schema
    const baseResult = this.baseSchema._parse(data, options);

    // If base validation fails, return error
    if (baseResult.isErr()) {
      return err(baseResult.unwrapErr());
    }

    // Apply transformation
    const baseValue = baseResult.unwrap();
    const transformedValue = this.transformer(baseValue);

    // Handle case where transformer returns a Result
    if (transformedValue instanceof Object &&
      '_tag' in transformedValue &&
      (transformedValue._tag === 'Ok' || transformedValue._tag === 'Err')) {
      return transformedValue as Result<TOutput, ValidationError>;
    }

    // Handle NaN values for number transformations
    if (typeof transformedValue === 'number' && isNaN(transformedValue)) {
      return err(new ValidationError([{
        path: options.path || [],
        message: `Failed to transform value "${String(data)}" to a valid number`,
        code: 'transform.invalid_number',
        params: { value: data }
      }]));
    }

    // Otherwise, wrap as Ok
    return ok(transformedValue as TOutput);
  }
  
  /**
   * Reverse transform from output to input
   */
  reverse(data: TOutput, options: ValidationOptions = {}): Result<TInput, ValidationError> {
    if (!this.reverseTransformer) {
      return err(new ValidationError([
        {
          path: options.path || [],
          message: 'Cannot reverse transform: no reverse transformer defined',
          code: 'transform.no_reverse',
        }
      ]));
    }
    
    // Apply reverse transformation
    const reverseResult = this.reverseTransformer(data);
    
    // Handle case where transformer returns a Result
    if (reverseResult instanceof Object && 
        '_tag' in reverseResult && 
        (reverseResult._tag === 'Ok' || reverseResult._tag === 'Err')) {
      return reverseResult as Result<TInput, ValidationError>;
    }
    
    // Validate the reverse transformed data with base schema
    return this.baseSchema.safeParse(reverseResult as TInput, options);
  }
  
  /**
   * Generate a partial schema
   */
  partial(): Schema<any> {
    // Create a partial version of the base schema
    const partialBase = this.baseSchema.partial();
    
    // Apply the same transformation to the partial schema
    return new TransformSchema(
      partialBase,
      this.transformer,
      this.reverseTransformer
    );
  }
}

/**
 * Helper for creating transform schemas
 */
export function transform<TInput, TOutput>(
  schema: Schema<TInput>,
  transformer: (value: TInput) => TOutput | Result<TOutput, ValidationError>,
  reverseTransformer?: (value: TOutput) => TInput | Result<TInput, ValidationError>
): TransformSchema<TInput, TOutput> {
  return new TransformSchema(schema, transformer, reverseTransformer);
}