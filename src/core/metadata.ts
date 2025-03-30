import { Schema, ValidationOptions } from './schema';
import { Result } from './result';
import { ValidationError } from './errors';

/**
 * Schema metadata
 */
export interface SchemaMetadata {
  /**
   * Schema description
   */
  description?: string;
  
  /**
   * Schema version
   */
  version?: string | number;
  
  /**
   * Deprecated fields
   */
  deprecated?: string[] | boolean;
  
  /**
   * Deprecation message
   */
  deprecationMessage?: string;
  
  /**
   * Examples
   */
  examples?: any[];
  
  /**
   * Custom metadata
   */
  [key: string]: any;
}

/**
 * Schema with metadata
 */
export class MetadataSchema<T> extends Schema<T> {
  constructor(
    private readonly baseSchema: Schema<T>,
    private readonly metadata: SchemaMetadata
  ) {
    super();
  }

  /**
   * Internal parse method
   */
  _parse(data: unknown, options: ValidationOptions): Result<T, ValidationError> {
    return this.baseSchema._parse(data, options);
  }
  
  /**
   * Get schema metadata
   */
  getMetadata(): SchemaMetadata {
    return { ...this.metadata };
  }
  
  /**
   * Add description to schema
   */
  describe(description: string): MetadataSchema<T> {
    return new MetadataSchema<T>(
      this.baseSchema,
      { ...this.metadata, description }
    );
  }
  
  /**
   * Mark schema as deprecated
   */
  deprecated(message?: string): MetadataSchema<T> {
    return new MetadataSchema<T>(
      this.baseSchema,
      { ...this.metadata, deprecated: true, deprecationMessage: message }
    );
  }

  /**
   * Mark fields as deprecated
   */
  markDeprecated(...fields: string[]): MetadataSchema<T> {
    const deprecated = Array.isArray(this.metadata.deprecated)
      ? [...this.metadata.deprecated, ...fields]
      : [...fields];

    return new MetadataSchema<T>(
      this.baseSchema,
      { ...this.metadata, deprecated }
    );
  }
  
  /**
   * Set schema version
   */
  setVersion(version: string | number): MetadataSchema<T> {
    return new MetadataSchema<T>(
      this.baseSchema,
      { ...this.metadata, version }
    );
  }
  
  /**
   * Add example
   */
  example(example: any): MetadataSchema<T> {
    const examples = [...(this.metadata.examples || []), example];
    return new MetadataSchema<T>(
      this.baseSchema,
      { ...this.metadata, examples }
    );
  }
  
  /**
   * Set custom metadata
   */
  meta(key: string, value: any): MetadataSchema<T> {
    return new MetadataSchema<T>(
      this.baseSchema,
      { ...this.metadata, [key]: value }
    );
  }
  
  /**
   * Generate a partial schema
   */
  partial(): Schema<any> {
    // Create a partial version of the base schema
    const partialBase = this.baseSchema.partial();
    
    // Apply the same metadata to the partial schema
    return new MetadataSchema(
      partialBase,
      this.metadata
    );
  }
  
  /**
   * Convert to OpenAPI schema
   * Note: This is a basic implementation and might need to be extended
   */
  toOpenAPI(): Record<string, any> {
    // Start with base schema if it supports OpenAPI conversion
    let openApiSchema: Record<string, any> = {};
    
    if (typeof (this.baseSchema as any).toJsonSchema === 'function') {
      openApiSchema = (this.baseSchema as any).toJsonSchema();
    }
    
    // Add metadata
    if (this.metadata.description) {
      openApiSchema.description = this.metadata.description;
    }
    
    if (this.metadata.examples && this.metadata.examples.length > 0) {
      openApiSchema.examples = this.metadata.examples;
    }
    
    if (this.metadata.deprecated === true) {
      openApiSchema.deprecated = true;
    }
    
    // Add any custom OpenAPI extensions
    for (const [key, value] of Object.entries(this.metadata)) {
      if (key.startsWith('x-')) {
        openApiSchema[key] = value;
      }
    }
    
    return openApiSchema;
  }
}

/**
 * Add metadata to a schema
 */
export function withMetadata<T>(
  schema: Schema<T>,
  metadata: SchemaMetadata = {}
): MetadataSchema<T> {
  return new MetadataSchema<T>(schema, metadata);
}