/**
 * Type for validation context
 * Can be any value that affects validation behavior
 */
export type ValidationContext = string | Record<string, any>;

/**
 * Options for context-aware validation
 */
export interface ContextOptions {
  /**
   * Current validation context
   */
  context?: ValidationContext;
}

/**
 * Context matching utility
 */
export function matchesContext(
  currentContext: ValidationContext | undefined,
  targetContext: ValidationContext
): boolean {
  // No context provided, so no match
  if (currentContext === undefined) {
    return false;
  }

  // String contexts
  if (typeof currentContext === 'string' && typeof targetContext === 'string') {
    return currentContext === targetContext;
  }

  // Object contexts - check if targetContext is a subset of currentContext
  if (
    typeof currentContext === 'object' &&
    typeof targetContext === 'object'
  ) {
    for (const [key, value] of Object.entries(targetContext)) {
      if (currentContext[key] !== value) {
        return false;
      }
    }
    return true;
  }

  return false;
}

/**
 * Extract context from validation options
 */
export function getContextFromOptions(options: any): ValidationContext | undefined {
  if (!options) return undefined;
  
  if (options.context !== undefined) {
    return options.context;
  }
  
  return undefined;
}