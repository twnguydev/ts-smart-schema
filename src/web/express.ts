import { Schema } from '../core/schema';
import { ValidationError } from '../core/errors';

/**
 * Express request location
 */
export type RequestLocation = 'body' | 'query' | 'params' | 'headers' | 'cookies';

/**
 * Options for Express validation
 */
export interface ExpressValidationOptions {
  /**
   * Error handler
   */
  errorHandler?: (err: ValidationError, req: any, res: any, next: any) => void;
  
  /**
   * Whether to continue on error
   */
  continueOnError?: boolean;
  
  /**
   * Validation context
   */
  context?: any;
}

/**
 * Default Express error handler
 */
function defaultExpressErrorHandler(
  err: ValidationError, 
  _req: any, 
  res: any, 
  _next: any
): void {
  res.status(400).json({
    error: 'Validation Error',
    issues: err.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
  });
}

/**
 * Create Express middleware for validation
 */
export function createExpressValidator<T>(
  schema: Schema<T>,
  location: RequestLocation = 'body',
  options: ExpressValidationOptions = {}
): (req: any, res: any, next: any) => void {
  // Default options
  const errorHandler = options.errorHandler || defaultExpressErrorHandler;
  const continueOnError = options.continueOnError || false;
  
  // Return middleware
  return function(req: any, res: any, next: any) {
    // Get data from request
    const data = req[location];
    if (data === undefined) {
      next();
      return;
    }
    
    try {
      // Validate data
      const validatedData = schema.parse(data, { 
        context: options.context,
      });
      
      // Replace original data with validated data
      req[location] = validatedData;
      
      // Continue
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        // Handle validation error
        if (continueOnError) {
          // Store error but continue
          req.validationError = error;
          next();
        } else {
          // Stop and handle error
          errorHandler(error, req, res, next);
        }
      } else {
        // Pass other errors to next error handler
        next(error);
      }
    }
  };
}

/**
 * Create middleware for validating the entire request
 */
export function createRequestValidator(schemas: {
  body?: Schema<any>;
  query?: Schema<any>;
  params?: Schema<any>;
  headers?: Schema<any>;
  cookies?: Schema<any>;
}, options: ExpressValidationOptions = {}): (req: any, res: any, next: any) => void {
  // Create validators for each location
  const validators: Array<(req: any, res: any, next: any) => void> = [];
  
  for (const [location, schema] of Object.entries(schemas)) {
    if (schema) {
      validators.push(
        createExpressValidator(
          schema, 
          location as RequestLocation, 
          { ...options, continueOnError: true }
        )
      );
    }
  }
  
  // Default error handler
  const errorHandler = options.errorHandler || defaultExpressErrorHandler;
  
  // Return combined middleware
  return function(req: any, res: any, next: any) {
    // Apply all validators in sequence
    let currentIndex = 0;
    
    function nextValidator() {
      // Clear previous validation error
      delete req.validationError;
      
      // Check if we're done
      if (currentIndex >= validators.length) {
        next();
        return;
      }
      
      // Get next validator
      const validator = validators[currentIndex++];
      
      // Apply validator
      validator(req, res, (err?: any) => {
        if (err) {
          next(err);
          return;
        }
        
        // Check for validation error
        if (req.validationError) {
          if (options.continueOnError) {
            // Continue to next validator
            nextValidator();
          } else {
            // Stop and handle error
            errorHandler(req.validationError, req, res, next);
          }
        } else {
          // Continue to next validator
          nextValidator();
        }
      });
    }
    
    // Start validation
    nextValidator();
  };
}