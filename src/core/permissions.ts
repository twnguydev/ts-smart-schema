import { Schema, ValidationOptions } from './schema';
import { Result, ok, err } from './result';
import { ValidationError } from './errors';

/**
 * User role or permission
 */
export type Role = string;

/**
 * Complex permission condition
 */
export interface PermissionCondition {
  /**
   * Required user role(s)
   */
  role?: Role | Role[];
  
  /**
   * Custom permission check
   */
  check?: (context: any) => boolean;
  
  /**
   * Message to show when access is denied
   */
  message?: string;
}

/**
 * Permission requirement for a field
 */
export type PermissionRequirement = Role | Role[] | PermissionCondition;

/**
 * Schema with permission control
 */
export class RestrictedSchema<T> extends Schema<T> {
  constructor(
    private readonly baseSchema: Schema<T>,
    private readonly permissionRequirement: PermissionRequirement
  ) {
    super();
  }

  /**
   * Internal parse method
   */
  _parse(data: unknown, options: ValidationOptions): Result<T, ValidationError> {
    // Get user role from context
    const userRoles = this.getUserRoles(options);
    
    // Check if user has permission
    if (!this.checkPermission(userRoles, options)) {
      return err(new ValidationError([
        {
          path: options.path || [],
          message: this.getAccessDeniedMessage(),
          code: 'permission.denied',
        },
      ]));
    }
    
    // If user has permission, use base schema
    return this.baseSchema._parse(data, options);
  }
  
  /**
   * Get user roles from context
   */
  private getUserRoles(options: ValidationOptions): Role[] {
    if (!options.context) return [];
    
    // Handle context with role(s)
    if (typeof options.context === 'string') {
      return [options.context];
    }
    
    if (Array.isArray(options.context)) {
      return options.context.filter(r => typeof r === 'string');
    }
    
    // Handle object context with roles
    if (typeof options.context === 'object') {
      const context = options.context as any;
      
      // Context with direct role property
      if (context.role) {
        return Array.isArray(context.role) 
          ? context.role
          : [context.role];
      }
      
      // Context with roles property
      if (context.roles) {
        return Array.isArray(context.roles) 
          ? context.roles
          : [context.roles];
      }
      
      // Context with user property
      if (context.user && context.user.role) {
        return Array.isArray(context.user.role) 
          ? context.user.role
          : [context.user.role];
      }
      
      if (context.user && context.user.roles) {
        return Array.isArray(context.user.roles) 
          ? context.user.roles
          : [context.user.roles];
      }
    }
    
    return [];
  }
  
  /**
   * Check if user has permission
   */
  private checkPermission(userRoles: Role[], options: ValidationOptions): boolean {
    const requirement = this.permissionRequirement;
    
    // Simple role requirement
    if (typeof requirement === 'string') {
      return userRoles.includes(requirement);
    }
    
    // Array of roles (any match)
    if (Array.isArray(requirement)) {
      return requirement.some(role => userRoles.includes(role));
    }
    
    // Complex permission condition
    const condition = requirement as PermissionCondition;
    
    // Check roles
    if (condition.role) {
      const requiredRoles = Array.isArray(condition.role) 
        ? condition.role 
        : [condition.role];
        
      if (!requiredRoles.some(role => userRoles.includes(role))) {
        return false;
      }
    }
    
    // Check custom condition
    if (condition.check && !condition.check(options.context)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get access denied message
   */
  private getAccessDeniedMessage(): string {
    const requirement = this.permissionRequirement;
    
    if (typeof requirement === 'object' && !Array.isArray(requirement) && requirement.message) {
      return requirement.message;
    }
    
    return 'Access denied: insufficient permissions';
  }
  
  /**
   * Generate a partial schema
   */
  partial(): Schema<any> {
    // Create a partial version of the base schema
    const partialBase = this.baseSchema.partial();
    
    // Apply the same permission restriction
    return new RestrictedSchema(
      partialBase,
      this.permissionRequirement
    );
  }
}

/**
 * Schema that can apply permission filtering
 */
export class PermissionAwareSchema<T extends Record<string, any>> extends Schema<T> {
  constructor(
    private readonly baseSchema: Schema<T>,
    private readonly fieldPermissions: Record<string, PermissionRequirement> = {}
  ) {
    super();
  }
  
  /**
   * Restrict access to a field based on permission
   */
  restrictField(
    field: string | string[],
    requirement: PermissionRequirement
  ): PermissionAwareSchema<T> {
    const fields = Array.isArray(field) ? field : [field];
    const newPermissions = { ...this.fieldPermissions };

    for (const f of fields) {
      newPermissions[f] = requirement;
    }

    return new PermissionAwareSchema<T>(
      this.baseSchema,
      newPermissions
    );
  }
  
  /**
   * Apply permissions based on context and remove restricted fields
   */
  applyPermissions(data: T, context: any): Partial<T> {
    // Result will contain only allowed fields
    const result: Partial<T> = {};
    
    // Convert context to array of roles
    const userRoles = this.extractRoles(context);
    
    // Check each field against permissions
    for (const [key, value] of Object.entries(data)) {
      // If field has specific permission requirement
      if (key in this.fieldPermissions) {
        const requirement = this.fieldPermissions[key];
        const hasPermission = this.checkPermission(requirement, userRoles, context);
        
        if (hasPermission) {
          result[key as keyof T] = value;
        }
      } else {
        // No specific requirement, include by default
        result[key as keyof T] = value;
      }
    }
    
    return result;
  }
  
  /**
   * Extract user roles from context
   */
  private extractRoles(context: any): Role[] {
    if (!context) return [];
    
    if (typeof context === 'string') {
      return [context];
    }
    
    if (Array.isArray(context)) {
      return context.filter(r => typeof r === 'string');
    }
    
    if (typeof context === 'object') {
      // Check common role properties
      if (context.role) {
        return Array.isArray(context.role) ? context.role : [context.role];
      }
      
      if (context.roles) {
        return Array.isArray(context.roles) ? context.roles : [context.roles];
      }
      
      if (context.user && context.user.role) {
        return Array.isArray(context.user.role) ? context.user.role : [context.user.role];
      }
      
      if (context.user && context.user.roles) {
        return Array.isArray(context.user.roles) ? context.user.roles : [context.user.roles];
      }
    }
    
    return [];
  }
  
  /**
   * Check if a permission requirement is satisfied
   */
  private checkPermission(
    requirement: PermissionRequirement,
    userRoles: Role[],
    context: any
  ): boolean {
    // String role
    if (typeof requirement === 'string') {
      return userRoles.includes(requirement);
    }
    
    // Array of roles (any match)
    if (Array.isArray(requirement)) {
      return requirement.some(role => userRoles.includes(role));
    }
    
    // Complex permission condition
    const condition = requirement as PermissionCondition;
    
    // Check roles
    if (condition.role) {
      const requiredRoles = Array.isArray(condition.role) 
        ? condition.role 
        : [condition.role];
        
      if (!requiredRoles.some(role => userRoles.includes(role))) {
        return false;
      }
    }
    
    // Check custom condition
    if (condition.check && !condition.check(context)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Internal parse method
   */
  _parse(data: unknown, options: ValidationOptions): Result<T, ValidationError> {
    // If no context, just use base schema
    if (!options.context) {
      return this.baseSchema._parse(data, options);
    }
    
    // Validate with base schema first
    const baseResult = this.baseSchema._parse(data, options);
    
    if (baseResult.isErr()) {
      return baseResult;
    }
    
    // Apply permissions
    const filteredData = this.applyPermissions(baseResult.unwrap(), options.context);
    
    return ok(filteredData as T);
  }
  
  /**
   * Generate a partial schema
   */
  partial(): Schema<any> {
    // Create a partial version of the base schema
    const partialBase = this.baseSchema.partial();
    
    // Apply the same field permissions
    return new PermissionAwareSchema(
      partialBase,
      this.fieldPermissions
    );
  }
}

/**
 * Restrict a schema based on permissions
 */
export function restrict<T>(
  schema: Schema<T>,
  requirement: PermissionRequirement
): RestrictedSchema<T> {
  return new RestrictedSchema(schema, requirement);
}

/**
 * Create a permission-aware schema
 */
export function withPermissions<T extends Record<string, any>>(
  schema: Schema<T>
): PermissionAwareSchema<T> {
  if (schema instanceof PermissionAwareSchema) {
    return schema;
  }
  return new PermissionAwareSchema(schema);
}