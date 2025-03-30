// Core functionality
import { ok, err, Result } from './core/result';
import { Schema, ValidationOptions, PartialSchema } from './core/schema';
import { ValidationError } from './core/errors';
import { biMap } from './core/bimap';
import { addVersionedToSchema } from './core/versioned';
import { withContext } from './core/contextual';
import { transform } from './core/transform';
import { preprocess, postprocess } from './core/process';
import { createVersionRegistry } from './core/migration';
import { withMetadata } from './core/metadata';
import { asyncValidate } from './core/async';
import { restrict, withPermissions } from './core/permissions';
import {
  createApiResponseSchema,
  createPaginatedSchema,
  createRecordSchema,
  createUnionSchema,
  createIntersectionSchema,
  createDiscriminatedUnionSchema,
  createLazySchema
} from './core/generic';

// Type schemas
import { string } from './types/string';
import { number } from './types/number';
import { object } from './types/object';
import { array } from './types/array';
import { createEnum } from './types/enum';

// Create a boolean schema function
const boolean = (): Schema<boolean> => {
  return new CustomSchema((value: unknown): Result<boolean, ValidationError> => {
    if (typeof value === 'boolean') {
      return ok(value);
    }
    return err(ValidationError.typeMismatch('boolean', value));
  });
};

// Create a null schema function
const nullSchema = (): Schema<null> => {
  return new CustomSchema((value: unknown): Result<null, ValidationError> => {
    if (value === null) {
      return ok(null);
    }
    return err(ValidationError.typeMismatch('null', value));
  });
};

// Create main schema namespace
const s = {
  // Type schemas
  string,
  number,
  boolean,
  object,
  array,
  enum: createEnum,
  null: nullSchema,

  // Versioning and migrations
  createVersionRegistry,
  withMetadata,

  // Async validation
  asyncValidate,

  // Permissions and RBAC
  restrict,
  withPermissions,

  // Generic schemas
  apiResponse: createApiResponseSchema,
  paginated: createPaginatedSchema,
  record: createRecordSchema,
  union: createUnionSchema,
  intersection: createIntersectionSchema,
  discriminatedUnion: createDiscriminatedUnionSchema,
  lazy: createLazySchema,

  // Helper functions
  ok,
  error: err,

  // Bidirectional mapping
  biMap,

  // Type inference helper
  InferType: {} as {
    <T>(schema: Schema<T>): T;
  },

  // Custom schema creation
  custom<T>(validator: (value: unknown) => Result<T, ValidationError>): Schema<T> {
    return new CustomSchema(validator);
  },
};

// Add versioned capability to all schemas
addVersionedToSchema();

// Custom schema implementation
class CustomSchema<T> extends Schema<T> {
  constructor(private readonly validator: (value: unknown) => Result<T, ValidationError>) {
    super();
  }

  _parse(data: unknown, options: ValidationOptions): Result<T, ValidationError> {
    return this.validator(data);
  }

  partial(): Schema<Partial<T>> {
    // For custom schemas, we can't infer a partial type without extra info
    // So we just return the same schema but cast it
    return this as unknown as Schema<Partial<T>>;
  }
}

// Export everything
export {
  s,
  Schema,
  ValidationError,
  ValidationOptions,
  biMap,
  PartialSchema,
  createVersionRegistry,
  withMetadata,
  asyncValidate,
  restrict,
  withPermissions,
};

// Web framework exports
export { 
  createExpressValidator,
  createRequestValidator 
} from './web/express';

export {
  createFastifyValidation,
  createFastifyPlugin,
  createFastifySchemas
} from './web/fastify';

// Database exports
export {
  createSchemaFromModel,
  createModelFromSchema,
  DatabaseSchemaGenerator,
  SQLSchemaAdapter
} from './db';

// Type utility exports
export type { Result } from './core/result';
export type { ValidationIssue } from './core/errors';
export type { InferObjectType } from './types/object';
export type { BiMapConfig, ToMappingFn, FromMappingFn } from './core/bimap';
export type { Versioned, VersionedOptions } from './core/versioned';