import { Schema, ValidationOptions } from './schema';
import { Result, ok } from './result';
import { ValidationError } from './errors';
import { ValidationContext, matchesContext } from './context';

/**
 * Schema with context-dependent validation
 */
export class ContextualSchema<T> extends Schema<T> {
  constructor(
    private readonly baseSchema: Schema<T>,
    private readonly contextRules: ContextualRule<T>[]
  ) {
    super();
  }

  /**
   * Internal parse method
   */
  _parse(data: unknown, options: ValidationOptions): Result<T, ValidationError> {
    const baseResult = this.baseSchema._parse(data, options);

    if (baseResult.isErr()) {
      return baseResult;
    }

    let validatedData = baseResult.unwrap();

    // Apply context-dependent validation rules
    for (const rule of this.contextRules) {
      // Check if rule applies to current context
      const currentContext = options.context as ValidationContext | undefined;
      if (matchesContext(currentContext, rule.context)) {
        // Apply custom validation
        const ruleResult = rule.validate(validatedData, options);

        // If rule validation fails, return error
        if (ruleResult.isErr()) {
          return ruleResult;
        }

        // Update validated data with rule result
        validatedData = ruleResult.unwrap();
      }
    }

    return ok(validatedData);
  }
  
  /**
   * Add a context-dependent validation rule
   */
  whenContext<S extends Schema<T>>(
    context: ValidationContext,
    validationFn: (schema: S) => Schema<T>
  ): ContextualSchema<T> {
    const newRule: ContextualRule<T> = {
      context,
      validate: (data, options) => {
        const schema = validationFn(this.baseSchema as unknown as S);
        return schema._parse(data, options);
      },
    };

    return new ContextualSchema<T>(
      this.baseSchema,
      [...this.contextRules, newRule]
    );
  }
  
  /**
   * Generate a partial schema
   */
  partial(): Schema<any> {
    // Create a partial version of the base schema
    const partialBase = this.baseSchema.partial();
    
    // Apply the same context rules to the partial schema
    return new ContextualSchema(
      partialBase,
      this.contextRules
    );
  }
}

/**
 * Context-dependent validation rule
 */
interface ContextualRule<T> {
  context: ValidationContext;
  validate: (data: T, options: ValidationOptions) => Result<T, ValidationError>;
}

/**
 * Create a context-dependent schema
 */
export function withContext<T>(schema: Schema<T>): ContextualSchema<T> {
  return new ContextualSchema(schema, []);
}