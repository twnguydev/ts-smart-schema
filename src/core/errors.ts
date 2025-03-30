/**
 * Represents a validation issue at a specific path
 */
export interface ValidationIssue {
  path: string[];
  message: string;
  code: string;
  params?: Record<string, any>;
}

/**
 * Validation error with details about validation failures
 */
export class ValidationError extends Error {
  /**
   * Create a new validation error
   * @param issues Array of validation issues
   */
  constructor(public readonly issues: ValidationIssue[]) {
    super(ValidationError.formatMessage(issues));
    this.name = 'ValidationError';
    
    // Support for Node's Error class
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  /**
   * Format a human-readable error message from validation issues
   */
  private static formatMessage(issues: ValidationIssue[]): string {
    if (issues.length === 0) {
      return 'Validation failed';
    }

    if (issues.length === 1) {
      const [issue] = issues;
      const path = issue.path.length ? issue.path.join('.') : 'value';
      return `Validation failed at ${path}: ${issue.message}`;
    }

    const issueMessages = issues
      .map(issue => {
        const path = issue.path.length ? issue.path.join('.') : 'value';
        return `  - ${path}: ${issue.message}`;
      })
      .join('\n');

    return `Validation failed with ${issues.length} issues:\n${issueMessages}`;
  }

  /**
   * Get issues at a specific path
   * @param path Path to filter issues by
   */
  getIssuesAtPath(path: string | string[]): ValidationIssue[] {
    const pathArray = typeof path === 'string' ? path.split('.') : path;
    
    return this.issues.filter(issue => {
      // Check if the issue path starts with the given path
      if (issue.path.length < pathArray.length) {
        return false;
      }
      
      for (let i = 0; i < pathArray.length; i++) {
        if (issue.path[i] !== pathArray[i]) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Create a ValidationError from a simple error message
   * @param message Error message
   * @param path Optional path to the error
   */
  static fromMessage(message: string, path: string[] = []): ValidationError {
    return new ValidationError([
      {
        path,
        message,
        code: 'invalid_value',
      },
    ]);
  }

  /**
   * Create a ValidationError for a type mismatch
   * @param expected Expected type
   * @param received Received value
   * @param path Optional path to the error
   */
  static typeMismatch(
    expected: string,
    received: any,
    path: string[] = []
  ): ValidationError {
    const actualType = typeof received;
    return new ValidationError([
      {
        path,
        message: `Expected ${expected}, received ${actualType}`,
        code: 'invalid_type',
        params: { expected, received: actualType },
      },
    ]);
  }
}