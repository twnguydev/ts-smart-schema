import { Schema } from '../core/schema';
import { ValidationError } from '../core/errors';

/**
 * Options for Fastify validation
 */
export interface FastifyValidationOptions {
  /**
   * Validation context
   */
  context?: any;
}

/**
 * Create Fastify validation for route options
 */
export function createFastifyValidation(schemas: {
  body?: Schema<any>;
  querystring?: Schema<any>;
  params?: Schema<any>;
  headers?: Schema<any>;
}, options: FastifyValidationOptions = {}): {
  body?: {
    preValidation: (request: any, reply: any, done: any) => void;
  };
  querystring?: {
    preValidation: (request: any, reply: any, done: any) => void;
  };
  params?: {
    preValidation: (request: any, reply: any, done: any) => void;
  };
  headers?: {
    preValidation: (request: any, reply: any, done: any) => void;
  };
} {
  const result: any = {};
  
  // Create validation for each schema
  for (const [location, schema] of Object.entries(schemas)) {
    if (schema) {
      result[location] = {
        preValidation: createPreValidator(schema, location, options),
      };
    }
  }
  
  return result;
}

/**
 * Create a pre-validation function for a specific location
 */
function createPreValidator(
  schema: Schema<any>,
  location: string,
  options: FastifyValidationOptions
): (request: any, reply: any, done: any) => void {
  return function(request: any, reply: any, done: any) {
    try {
      // Get data from request
      const data = request[location];
      
      // Validate data
      const validatedData = schema.parse(data, {
        context: options.context,
      });
      
      // Replace original data with validated data
      request[location] = validatedData;
      
      // Continue
      done();
    } catch (error) {
      if (error instanceof ValidationError) {
        // Create Fastify validation error
        const statusCode = 400;
        const validationError = new Error('Validation Error');
        
        // Add additional properties
        Object.assign(validationError, {
          statusCode,
          validation: error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
          validationContext: location,
        });
        
        // Pass error to Fastify
        done(validationError);
      } else {
        // Pass other errors
        done(error);
      }
    }
  };
}

/**
 * Create a plugin for schema serialization
 */
export function createFastifySerializerPlugin(schema: Schema<any>): {
  serialize: (data: any) => string;
} {
  return {
    serialize: (data: any) => {
      // Validate data against schema
      const validatedData = schema.parse(data);
      
      // Serialize to JSON
      return JSON.stringify(validatedData);
    }
  };
}

/**
 * Create a Fastify plugin for schema validation
 */
export function createFastifyPlugin(options: {
  errorHandler?: (error: ValidationError, request: any, reply: any) => void;
}): (fastify: any, opts: any, done: any) => void {
  // Default error handler
  const errorHandler = options.errorHandler || defaultFastifyErrorHandler;
  
  // Return plugin
  return function(fastify: any, _opts: any, done: any) {
    // Add decorator for schema validation
    fastify.decorate('smartSchema', {
      // Validate body
      body: (schema: Schema<any>, opts: FastifyValidationOptions = {}) => {
        return {
          preValidation: createPreValidator(schema, 'body', opts),
        };
      },
      
      // Validate query
      query: (schema: Schema<any>, opts: FastifyValidationOptions = {}) => {
        return {
          preValidation: createPreValidator(schema, 'query', opts),
        };
      },
      
      // Validate params
      params: (schema: Schema<any>, opts: FastifyValidationOptions = {}) => {
        return {
          preValidation: createPreValidator(schema, 'params', opts),
        };
      },
      
      // Validate headers
      headers: (schema: Schema<any>, opts: FastifyValidationOptions = {}) => {
        return {
          preValidation: createPreValidator(schema, 'headers', opts),
        };
      },
      
      // Validate multiple parts of the request
      validate: (schemas: {
        body?: Schema<any>;
        query?: Schema<any>;
        params?: Schema<any>;
        headers?: Schema<any>;
      }, opts: FastifyValidationOptions = {}) => {
        const hooks: any[] = [];
        
        // Add validation for each schema
        for (const [location, schema] of Object.entries(schemas)) {
          if (schema) {
            hooks.push(createPreValidator(schema, location, opts));
          }
        }
        
        // Return combined hooks
        return {
          preValidation: hooks,
        };
      },
      
      // Response serialization
      response: (schema: Schema<any>) => {
        return {
          schema: {
            response: {
              200: {
                serialize: createFastifySerializerPlugin(schema),
              },
            },
          },
        };
      },
    });
    
    // Add error handler
    fastify.setErrorHandler(function(error: any, request: any, reply: any) {
      if (error instanceof ValidationError) {
        // Handle validation error
        errorHandler(error, request, reply);
      } else if (error.validation) {
        // Handle Fastify validation error
        const validationError = new ValidationError(
          error.validation.map((v: any) => ({
            path: v.path ? v.path.split('.') : [],
            message: v.message,
            code: v.code || 'validation.error',
          }))
        );
        
        // Call error handler
        errorHandler(validationError, request, reply);
      } else {
        // Pass to default error handler
        reply.send(error);
      }
    });
    
    // Finish plugin initialization
    done();
  };
}

/**
 * Default Fastify error handler
 */
function defaultFastifyErrorHandler(
  error: ValidationError,
  _request: any,
  reply: any
): void {
  reply.status(400).send({
    error: 'Validation Error',
    issues: error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
  });
}

/**
 * Helper to create Fastify validation and serialization
 */
export function createFastifySchemas(schemas: {
  request?: {
    body?: Schema<any>;
    querystring?: Schema<any>;
    params?: Schema<any>;
    headers?: Schema<any>;
  };
  response?: Schema<any>;
}): any {
  const result: any = {};
  
  // Add request validation
  if (schemas.request) {
    const validation = createFastifyValidation(schemas.request);
    Object.assign(result, validation);
  }
  
  // Add response serialization
  if (schemas.response) {
    result.schema = {
      response: {
        200: {
          serialize: createFastifySerializerPlugin(schemas.response),
        },
      },
    };
  }
  
  return result;
}