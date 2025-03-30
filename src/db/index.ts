import { Schema, ValidationOptions } from '../core/schema';
import { ValidationError } from '../core/errors';
import { Result, ok, err } from '../core/result';

/**
 * Database field type
 */
export interface DBField {
  /**
   * Field name
   */
  name: string;
  
  /**
   * Field type
   */
  type: string;
  
  /**
   * Whether the field is required
   */
  required?: boolean;
  
  /**
   * Whether the field is unique
   */
  unique?: boolean;
  
  /**
   * Field default value
   */
  default?: any;
  
  /**
   * Field description
   */
  description?: string;
  
  /**
   * Field validation constraints
   */
  constraints?: {
    min?: number;
    max?: number;
    pattern?: string;
    [key: string]: any;
  };
}

/**
 * Database model definition
 */
export interface DBModel {
  /**
   * Model name
   */
  name: string;
  
  /**
   * Model fields
   */
  fields: DBField[];
  
  /**
   * Model description
   */
  description?: string;
}

// Interface pour les propriétés internes des schemas
interface SchemaInternals {
  _shape?: Record<string, Schema<any>>;
  _required?: Set<string>;
  _min?: number;
  _max?: number;
  _minLength?: number;
  _maxLength?: number;
  _pattern?: RegExp;
  _format?: string;
  _integer?: boolean;
  _positive?: boolean;
  _negative?: boolean;
  getMetadata?: () => any;
}

// Type augmentation pour permettre l'accès sûr aux propriétés internes
type SchemaWithInternals<T> = Schema<T> & SchemaInternals;

/**
 * Create a schema from a database model
 */
export function createSchemaFromModel(model: DBModel): Schema<any> {
  const { s } = require('../index');
  
  // Create schema for each field
  const shape: Record<string, Schema<any>> = {};
  
  for (const field of model.fields) {
    // Create base schema based on field type
    let fieldSchema: Schema<any>;
    
    switch (field.type.toLowerCase()) {
      case 'string':
      case 'text':
      case 'varchar':
      case 'char':
        fieldSchema = s.string();
        
        // Add string constraints
        if (field.constraints) {
          if (field.constraints.min !== undefined) {
            fieldSchema = (fieldSchema as any).min(field.constraints.min);
          }
          
          if (field.constraints.max !== undefined) {
            fieldSchema = (fieldSchema as any).max(field.constraints.max);
          }
          
          if (field.constraints.pattern) {
            fieldSchema = (fieldSchema as any).regex(new RegExp(field.constraints.pattern));
          }
          
          if (field.constraints.email) {
            fieldSchema = (fieldSchema as any).email();
          }
          
          if (field.constraints.uuid) {
            fieldSchema = (fieldSchema as any).uuid();
          }
        }
        break;
        
      case 'number':
      case 'int':
      case 'integer':
      case 'float':
      case 'decimal':
        fieldSchema = s.number();
        
        // Add number constraints
        if (field.type.toLowerCase() === 'int' || field.type.toLowerCase() === 'integer') {
          fieldSchema = (fieldSchema as any).int();
        }
        
        if (field.constraints) {
          if (field.constraints.min !== undefined) {
            fieldSchema = (fieldSchema as any).min(field.constraints.min);
          }
          
          if (field.constraints.max !== undefined) {
            fieldSchema = (fieldSchema as any).max(field.constraints.max);
          }
          
          if (field.constraints.positive) {
            fieldSchema = (fieldSchema as any).positive();
          }
          
          if (field.constraints.negative) {
            fieldSchema = (fieldSchema as any).negative();
          }
        }
        break;
        
      case 'boolean':
      case 'bool':
        fieldSchema = s.boolean();
        break;
        
      case 'date':
      case 'datetime':
      case 'timestamp':
        // Handle date as string with transformation
        fieldSchema = s.string().transform(
          (value: string | number | Date) => new Date(value),
          (date: { toISOString: () => string }) => date.toISOString()
        );
        break;
        
      case 'array':
      case 'json':
        // Handle array or JSON as any[]
        fieldSchema = s.array(s.custom((value: any) => ok(value)));
        break;
        
      case 'object':
      case 'map':
        // Handle object as Record<string, any>
        fieldSchema = s.object({});
        // Extend with custom _parse (use as any to allow the extension)
        fieldSchema = (fieldSchema as any).extend({
          _parse: (data: unknown, options: ValidationOptions): Result<any, ValidationError> => {
            if (typeof data !== 'object' || data === null || Array.isArray(data)) {
              return err(ValidationError.typeMismatch('object', data, options.path || []));
            }
            return ok(data);
          }
        });
        break;
        
      default:
        // Default to any
        fieldSchema = s.custom((value: any) => ok(value));
    }
    
    // Add description if available
    if (field.description) {
      fieldSchema = (fieldSchema as any).describe(field.description);
    }
    
    // Make optional if not required
    if (!field.required) {
      fieldSchema = (fieldSchema as any).optional();
    }
    
    // Add to shape
    shape[field.name] = fieldSchema;
  }
  
  // Create object schema
  let modelSchema = s.object(shape);
  
  // Add description if available
  if (model.description) {
    modelSchema = (modelSchema as any).describe(model.description);
  }
  
  return modelSchema;
}

/**
 * Create a DB model from a schema
 */
export function createModelFromSchema(
  name: string,
  schema: Schema<any>,
  options: {
    description?: string;
  } = {}
): DBModel {
  // Extract field definitions from schema
  // Note: This requires internal knowledge of the schema structure
  // and is limited to what we can infer
  
  const fields: DBField[] = [];
  const schemaWithInternals = schema as SchemaWithInternals<any>;
  
  // If it's an object schema, we can extract fields
  if (schemaWithInternals._shape) {
    const shape = schemaWithInternals._shape;
    const required = schemaWithInternals._required;
    
    for (const [fieldName, fieldSchema] of Object.entries(shape)) {
      const field: DBField = {
        name: fieldName,
        type: inferTypeFromSchema(fieldSchema as SchemaWithInternals<any>),
        required: required ? required.has(fieldName) : false,
      };
      
      // Try to extract description
      const fieldSchemaWithInternals = fieldSchema as SchemaWithInternals<any>;
      if (typeof fieldSchemaWithInternals.getMetadata === 'function') {
        const metadata = fieldSchemaWithInternals.getMetadata();
        
        if (metadata && metadata.description) {
          field.description = metadata.description;
        }
        
        // Extract constraints if any
        field.constraints = extractConstraints(fieldSchemaWithInternals);
      }
      
      fields.push(field);
    }
  }
  
  return {
    name,
    fields,
    description: options.description,
  };
}

/**
 * Infer DB type from schema
 */
function inferTypeFromSchema(schema: SchemaWithInternals<any>): string {
  // Check schema constructor name
  const constructorName = schema.constructor.name;
  
  switch (constructorName) {
    case 'StringSchema':
      return 'string';
      
    case 'NumberSchema':
      return schema._integer ? 'integer' : 'number';
      
    case 'BooleanSchema':
    case 'CustomSchema': // Assuming boolean is implemented as custom
      return 'boolean';
      
    case 'ArraySchema':
      return 'array';
      
    case 'ObjectSchema':
      return 'object';
      
    default:
      return 'any';
  }
}

/**
 * Extract constraints from schema
 */
function extractConstraints(schema: SchemaWithInternals<any>): Record<string, any> | undefined {
  const constraints: Record<string, any> = {};
  
  // String constraints
  if (schema._minLength !== undefined) {
    constraints.min = schema._minLength;
  }
  
  if (schema._maxLength !== undefined) {
    constraints.max = schema._maxLength;
  }
  
  if (schema._pattern) {
    constraints.pattern = schema._pattern.source;
  }
  
  if (schema._format === 'email') {
    constraints.email = true;
  }
  
  if (schema._format === 'uuid') {
    constraints.uuid = true;
  }
  
  // Number constraints
  if (schema._min !== undefined) {
    constraints.min = schema._min;
  }
  
  if (schema._max !== undefined) {
    constraints.max = schema._max;
  }
  
  if (schema._positive) {
    constraints.positive = true;
  }
  
  if (schema._negative) {
    constraints.negative = true;
  }
  
  return Object.keys(constraints).length > 0 ? constraints : undefined;
}

/**
 * Generate a schema from database connection (abstract base)
 */
export abstract class DatabaseSchemaGenerator {
  /**
   * Generate schema for a table
   */
  abstract generateTableSchema(tableName: string): Promise<Schema<any>>;
  
  /**
   * Generate schemas for all tables
   */
  abstract generateAllSchemas(): Promise<Record<string, Schema<any>>>;
  
  /**
   * Get a list of available tables
   */
  abstract getTables(): Promise<string[]>;
}

/**
 * SQL schema adapter (abstract base for SQL databases)
 */
export abstract class SQLSchemaAdapter extends DatabaseSchemaGenerator {
  protected abstract getConnection(): any;
  
  /**
   * Map SQL types to our field types
   */
  protected abstract mapSqlType(sqlType: string): string;
  
  /**
   * Query to get table columns
   */
  protected abstract getColumnsQuery(tableName: string): string;
  
  /**
   * Query to get table list
   */
  protected abstract getTablesQuery(): string;
  
  /**
   * Execute a SQL query
   */
  protected abstract executeQuery<T>(query: string): Promise<T[]>;
  
  /**
   * Generate schema for a table from SQL
   */
  async generateTableSchema(tableName: string): Promise<Schema<any>> {
    // Get columns
    const columns = await this.executeQuery(this.getColumnsQuery(tableName));
    
    // Create model
    const model: DBModel = {
      name: tableName,
      fields: columns.map(column => this.columnToField(column)),
    };
    
    // Create schema
    return createSchemaFromModel(model);
  }
  
  /**
   * Generate schemas for all tables
   */
  async generateAllSchemas(): Promise<Record<string, Schema<any>>> {
    // Get tables
    const tables = await this.getTables();
    
    // Generate schema for each table
    const schemas: Record<string, Schema<any>> = {};
    
    for (const table of tables) {
      schemas[table] = await this.generateTableSchema(table);
    }
    
    return schemas;
  }
  
  /**
   * Get a list of available tables
   */
  async getTables(): Promise<string[]> {
    const result = await this.executeQuery<{ table_name: string }>(this.getTablesQuery());
    return result.map(row => row.table_name);
  }
  
  /**
   * Convert SQL column to field definition
   */
  protected abstract columnToField(column: any): DBField;
}