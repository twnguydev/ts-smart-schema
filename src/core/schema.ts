import { Result, ok, err } from './result';
import { ValidationError, ValidationIssue } from './errors';

declare module './schema' {
  interface Schema<T> {
    createVersioned(data: T, options?: import('./versioned').VersionedOptions): import('./versioned').Versioned<T>;
  }
}

/**
 * Options for Schema validation
 */
export interface ValidationOptions {
  /**
   * Path prefix for validation errors
   */
  path?: string[];
  
  /**
   * Whether to abort validation on first error
   */
  abortEarly?: boolean;
  
  /**
   * Whether to strip unknown properties from objects
   */
  stripUnknown?: boolean;
  
  /**
   * Whether to add default values for missing properties
   */
  defaults?: boolean;

  /**
   * Current validation context
   * Used for context-aware validation rules
   */
  context?: any;
}

/**
 * Default validation options
 */
export const DEFAULT_VALIDATION_OPTIONS: ValidationOptions = {
  path: [],
  abortEarly: false,
  stripUnknown: false,
  defaults: true,
};

/**
 * Base schema interface for all schema types
 */
export interface SchemaType<T> {
  /**
   * Parse and validate input data
   */
  parse(data: unknown, options?: ValidationOptions): T;
  
  /**
   * Check if input data is valid without parsing
   */
  validate(data: unknown, options?: ValidationOptions): Result<void, ValidationError>;
  
  /**
   * Parse input data and safely handle errors
   */
  safeParse(data: unknown, options?: ValidationOptions): Result<T, ValidationError>;
  
  /**
   * Parse and validate input data asynchronously
   */
  parseAsync(data: unknown, options?: ValidationOptions): Promise<T>;
  
  /**
   * Internal parse method (exposé dans l'interface pour permettre l'accès entre les classes dérivées)
   */
  _parse(data: unknown, options: ValidationOptions): Result<T, ValidationError>;
  
  /**
   * Generate a partial schema
   */
  partial(): Schema<any>;
}

/**
 * Interface for partial schema that preserves methods like required
 */
export interface PartialSchema<T> extends Schema<Partial<T>> {
  required<K extends keyof T>(keys: K | K[]): PartialSchema<T>;
}

/**
 * Base class for all schema implementations
 */
export abstract class Schema<T> implements SchemaType<T> {
  /**
   * Parse and validate input data
   */
  parse(data: unknown, options: ValidationOptions = {}): T {
    const mergedOptions = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
    const result = this._parse(data, mergedOptions);

    if (result.isOk()) {
      return result.unwrap();
    }

    throw result.unwrapErr();
  }
  
  /**
   * Check if input data is valid without parsing
   */
  validate(data: unknown, options: ValidationOptions = {}): Result<void, ValidationError> {
    const mergedOptions = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
    const result = this._parse(data, mergedOptions);
    
    if (result.isOk()) {
      return ok(undefined);
    }
    
    return err(result.unwrapErr());
  }
  
  /**
   * Parse input data and safely handle errors
   */
  safeParse(data: unknown, options: ValidationOptions = {}): Result<T, ValidationError> {
    const mergedOptions = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
    return this._parse(data, mergedOptions);
  }


  /**
   * Refine the schema with a custom validation function
   */
  refine(
    refinement: (value: T) => boolean | Promise<boolean>,
    message: string | ((value: T) => string)
  ): Schema<T> {
    return new RefinedSchema<T>(this, refinement, message);
  }
  
  /**
   * Add context-dependent validation
   */
  whenContext<S extends Schema<T>>(
    context: any,
    validationFn: (schema: S) => Schema<T>
  ): Schema<T> {
    return new (require('./contextual').ContextualSchema)(this, [
      {
        context,
        validate: (data: T, options: ValidationOptions) =>
          validationFn(this as unknown as S)._parse(data, options),
      },
    ]);
  }

  /**
   * Transform the output of this schema
   */
  transform<U>(
    transformer: (value: T) => U | Result<U, ValidationError>,
    reverseTransformer?: (value: U) => T | Result<T, ValidationError>
  ): Schema<U> {
    return new (require('./transform').TransformSchema)(
      this,
      transformer,
      reverseTransformer
    );
  }
    
  /**
   * Preprocess input data before validation
   */
  preprocess(preprocessor: (value: unknown) => unknown): Schema<T> {
    return new (require('./process').PreprocessSchema)(
      this,
      preprocessor
    );
  }

  /**
   * Postprocess validated data
   */
  postprocess<U>(postprocessor: (value: T) => U): Schema<U> {
    return new (require('./process').PostprocessSchema)(
      this,
      postprocessor
    );
  }

  /**
   * Add description to the schema
   */
  describe(description: string): Schema<T> {
    return new (require('./metadata').MetadataSchema)(
      this,
      { description }
    );
  }
  
  /**
   * Add an example to the schema
   */
  example(example: any): Schema<T> {
    return new (require('./metadata').MetadataSchema)(
      this,
      { examples: [example] }
    );
  }
  
  /**
   * Set schema as deprecated
   */
  deprecated(message?: string): Schema<T> {
    return new (require('./metadata').MetadataSchema)(
      this,
      { deprecated: true, deprecationMessage: message }
    );
  }

  /**
   * Add minimum validation (generic method)
   * Note: This is a convenience method that should be overridden by specific schema types
   */
  min(value: number): Schema<T> {
    // Default implementation that will be overridden
    return this;
  }
  
  /**
   * Add maximum validation (generic method)
   * Note: This is a convenience method that should be overridden by specific schema types
   */
  max(value: number): Schema<T> {
    // Default implementation that will be overridden
    return this;
  }

  /**
   * Add custom metadata
   */
  meta(key: string, value: any): Schema<T> {
    return new (require('./metadata').MetadataSchema)(
      this,
      { [key]: value }
    );
  }

  /**
   * Restrict this schema based on permission
   */
  restrict(requirement: any): Schema<T> {
    return (require('./permissions').restrict)(this, requirement);
  }

  /**
   * Regex validation (generic method)
   */
  regex(pattern: RegExp): Schema<T> {
    // Default implementation that will be overridden
    return this;
  }

  /**
   * Email validation (generic method)
   */
  email(): Schema<T> {
    // Default implementation that will be overridden
    return this;
  }

  /**
   * UUID validation (generic method)
   */
  uuid(): Schema<T> {
    // Default implementation that will be overridden
    return this;
  }

  /**
   * Integer validation (generic method)
   */
  int(): Schema<T> {
    // Default implementation that will be overridden
    return this;
  }

  /**
   * Positive number validation (generic method)
   */
  positive(): Schema<T> {
    // Default implementation that will be overridden
    return this;
  }

  /**
   * Negative number validation (generic method)
   */
  negative(): Schema<T> {
    // Default implementation that will be overridden
    return this;
  }

  /**
   * Optional validation (generic method)
   */
  optional(): Schema<T | undefined> {
    // Default implementation that will be overridden
    return this;
  }

  /**
   * Add permission-awareness to this schema
   */
  withPermissions<T extends Record<string, any>>(this: Schema<T>): any {
    return (require('./permissions').withPermissions)(this);
  }

  /**
   * Parse and validate input data asynchronously
   */
  async parseAsync(data: unknown, options: ValidationOptions = {}): Promise<T> {
    const mergedOptions = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
    const result = this._parse(data, mergedOptions);

    if (result.isOk()) {
      return result.unwrap();
    }

    throw result.unwrapErr();
  }

  /**
   * Add asynchronous validation
   */
  asyncValidate(
    validator: (value: T) => Promise<boolean | Result<T, ValidationError> | void>,
    errorMessage?: string
  ): Schema<T> {
    return (require('./async').asyncValidate)(this, validator, errorMessage);
  }
  
  /**
   * Internal parse method to be implemented by schema types
   */
  abstract _parse(data: unknown, options: ValidationOptions): Result<T, ValidationError>;
  
  /**
   * Create a validation issue for the current schema
   */
  protected issue(
    message: string,
    code: string,
    path: string[] = [],
    params?: Record<string, any>
  ): ValidationIssue {
    return {
      path,
      message,
      code,
      params,
    };
  }
  
  /**
   * Helper to create a validation error
   */
  protected validationError(issues: ValidationIssue[]): ValidationError {
    return new ValidationError(issues);
  }
  
  /**
   * Generate a partial schema
   * Nous ne spécifions pas de type de retour précis car cela varie selon les implémentations.
   * Chaque sous-classe doit implémenter cette méthode avec le bon type de retour.
   */
  abstract partial(): Schema<any>;
  
  /**
   * Create a new schema that extends this one with additional methods
   */
  extend<U extends Record<string, any>>(methods: U): this & U {
    const schema = this;
    const extension = { ...methods };
    
    // Copy all methods to this schema instance
    for (const [key, value] of Object.entries(extension)) {
      (schema as any)[key] = value;
    }
    
    return schema as this & U;
  }
  
  /**
   * Apply a set of validation rules to this schema
   */
  apply<U extends T>(rules: RuleSet<T, U>): Schema<U> {
    return rules.apply(this);
  }
}

/**
 * Interface for a set of validation rules
 */
export interface RuleSet<T, U extends T> {
  apply(schema: Schema<T>): Schema<U>;
}

/**
 * Schema that applies a refinement to a base schema
 */
class RefinedSchema<T> extends Schema<T> {
  constructor(
    private readonly base: Schema<T>,
    private readonly refinement: (value: T) => boolean | Promise<boolean>,
    private readonly message: string | ((value: T) => string)
  ) {
    super();
  }
  
  _parse(data: unknown, options: ValidationOptions): Result<T, ValidationError> {
    const result = this.base._parse(data, options);
    
    if (result.isErr()) {
      return result;
    }
    
    const value = result.unwrap();
    
    if (!this.refinement(value)) {
      const errorMessage = typeof this.message === 'function'
        ? this.message(value)
        : this.message;
      
      return err(
        new ValidationError([
          this.issue(
            errorMessage,
            'custom',
            options.path
          ),
        ])
      );
    }
    
    return ok(value);
  }
  

  partial(): Schema<any> {
    // Create a partial version of the base schema
    const partialBase = this.base.partial();
    
    // Pour résoudre le problème de type, nous créons un nouveau schéma raffiné
    // qui accepte le même type que le schéma partiel de base
    return new RefinedSchema<any>(
      partialBase,
      (value) => {
        // Nous supposons que le raffinement fonctionne pour des valeurs partielles
        return this.refinement(value as unknown as T);
      },
      typeof this.message === 'function'
        ? (value) => typeof this.message === 'function' ? this.message(value as unknown as T) : this.message
        : this.message
    );
  }
}