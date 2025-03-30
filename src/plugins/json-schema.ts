import { Schema } from '../core/schema';
import { ObjectSchema } from '../types/object';
import { StringSchema } from '../types/string';
import { NumberSchema } from '../types/number';
import { ArraySchema } from '../types/array';

/**
 * JSON Schema representation
 */
export interface JSONSchema {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  multipleOf?: number;
  format?: string;
  enum?: any[];
  $ref?: string;
  title?: string;
  description?: string;
  default?: any;
  additionalProperties?: boolean | JSONSchema;
  [key: string]: any;
}

/**
 * Convert a schema to JSON Schema
 */
export function toJsonSchema(schema: Schema<any>): JSONSchema {
  if (schema instanceof StringSchema) {
    return convertStringSchema(schema);
  } else if (schema instanceof NumberSchema) {
    return convertNumberSchema(schema);
  } else if (schema instanceof ObjectSchema) {
    return convertObjectSchema(schema);
  } else if (schema instanceof ArraySchema) {
    return convertArraySchema(schema);
  }
  
  // Default fallback
  return { type: 'object' };
}

/**
 * Convert StringSchema to JSON Schema
 */
function convertStringSchema(schema: StringSchema): JSONSchema {
  const jsonSchema: JSONSchema = {
    type: 'string',
  };
  
  // Access private properties if available
  const privateProps = schema as any;
  
  if (privateProps._minLength !== undefined) {
    jsonSchema.minLength = privateProps._minLength;
  }
  
  if (privateProps._maxLength !== undefined) {
    jsonSchema.maxLength = privateProps._maxLength;
  }
  
  if (privateProps._pattern) {
    jsonSchema.pattern = privateProps._pattern.source;
  }
  
  if (privateProps._format) {
    jsonSchema.format = privateProps._format;
  }
  
  return jsonSchema;
}

/**
 * Convert NumberSchema to JSON Schema
 */
function convertNumberSchema(schema: NumberSchema): JSONSchema {
  const jsonSchema: JSONSchema = {
    type: 'number',
  };
  
  // Access private properties if available
  const privateProps = schema as any;
  
  if (privateProps._integer) {
    jsonSchema.type = 'integer';
  }
  
  if (privateProps._min !== undefined) {
    jsonSchema.minimum = privateProps._min;
  }
  
  if (privateProps._max !== undefined) {
    jsonSchema.maximum = privateProps._max;
  }
  
  if (privateProps._multipleOf !== undefined) {
    jsonSchema.multipleOf = privateProps._multipleOf;
  }
  
  return jsonSchema;
}

/**
 * Convert ObjectSchema to JSON Schema
 */
function convertObjectSchema(schema: ObjectSchema<any>): JSONSchema {
  const jsonSchema: JSONSchema = {
    type: 'object',
    properties: {},
    required: [],
  };
  
  // Access private properties if available
  const privateProps = schema as any;
  
  if (privateProps._shape) {
    for (const [key, propSchema] of Object.entries(privateProps._shape)) {
      jsonSchema.properties![key] = toJsonSchema(propSchema as Schema<any>);
    }
  }
  
  if (privateProps._required && privateProps._required.size > 0) {
    jsonSchema.required = Array.from(privateProps._required);
  }
  
  return jsonSchema;
}

/**
 * Convert ArraySchema to JSON Schema
 */
function convertArraySchema(schema: ArraySchema<any>): JSONSchema {
  const jsonSchema: JSONSchema = {
    type: 'array',
  };
  
  // Access private properties if available
  const privateProps = schema as any;
  
  if (privateProps._itemSchema) {
    jsonSchema.items = toJsonSchema(privateProps._itemSchema);
  }
  
  if (privateProps._minItems !== undefined) {
    jsonSchema.minItems = privateProps._minItems;
  }
  
  if (privateProps._maxItems !== undefined) {
    jsonSchema.maxItems = privateProps._maxItems;
  }
  
  if (privateProps._uniqueItems) {
    jsonSchema.uniqueItems = privateProps._uniqueItems;
  }
  
  return jsonSchema;
}

/**
 * Convert from JSON Schema to a schema
 * Note: This is a simplified implementation that doesn't support all JSON Schema features
 */
export function fromJsonSchema(jsonSchema: JSONSchema): Schema<any> {
  const { s } = require('../index');
  
  if (!jsonSchema.type) {
    // Default to object if type is not specified
    return s.object({});
  }
  
  const type = Array.isArray(jsonSchema.type) ? jsonSchema.type[0] : jsonSchema.type;
  
  switch (type) {
    case 'string':
      return convertJsonToStringSchema(jsonSchema);
      
    case 'number':
    case 'integer':
      return convertJsonToNumberSchema(jsonSchema);
      
    case 'array':
      return convertJsonToArraySchema(jsonSchema);
      
    case 'object':
      return convertJsonToObjectSchema(jsonSchema);
      
    default:
      // For unknown types, return a custom schema that validates anything
      return s.custom((value: any) => s.ok(value));
  }
}

/**
 * Convert JSON Schema to StringSchema
 */
function convertJsonToStringSchema(jsonSchema: JSONSchema): Schema<string> {
  const { s } = require('../index');
  let schema = s.string();
  
  if (jsonSchema.minLength !== undefined) {
    schema = schema.min(jsonSchema.minLength);
  }
  
  if (jsonSchema.maxLength !== undefined) {
    schema = schema.max(jsonSchema.maxLength);
  }
  
  if (jsonSchema.pattern) {
    schema = schema.regex(new RegExp(jsonSchema.pattern));
  }
  
  if (jsonSchema.format) {
    // Handle common string formats
    switch (jsonSchema.format) {
      case 'email':
        schema = schema.email();
        break;
      case 'uri':
      case 'url':
        schema = schema.url();
        break;
      case 'uuid':
        schema = schema.uuid();
        break;
    }
  }
  
  return schema;
}

/**
 * Convert JSON Schema to NumberSchema
 */
function convertJsonToNumberSchema(jsonSchema: JSONSchema): Schema<number> {
  const { s } = require('../index');
  let schema = s.number();
  
  if (jsonSchema.type === 'integer') {
    schema = schema.int();
  }
  
  if (jsonSchema.minimum !== undefined) {
    schema = schema.min(jsonSchema.minimum);
  }
  
  if (jsonSchema.maximum !== undefined) {
    schema = schema.max(jsonSchema.maximum);
  }
  
  if (jsonSchema.multipleOf !== undefined) {
    schema = schema.multipleOf(jsonSchema.multipleOf);
  }
  
  return schema;
}

/**
 * Convert JSON Schema to ArraySchema
 */
function convertJsonToArraySchema(jsonSchema: JSONSchema): Schema<any[]> {
  const { s } = require('../index');
  
  // Convert items schema or use a passthrough schema
  const itemSchema = jsonSchema.items 
    ? fromJsonSchema(jsonSchema.items)
    : s.custom((value: any) => s.ok(value));
  
  let schema = s.array(itemSchema);
  
  if (jsonSchema.minItems !== undefined) {
    schema = schema.min(jsonSchema.minItems);
  }
  
  if (jsonSchema.maxItems !== undefined) {
    schema = schema.max(jsonSchema.maxItems);
  }
  
  if (jsonSchema.uniqueItems) {
    schema = schema.unique();
  }
  
  return schema;
}

/**
 * Convert JSON Schema to ObjectSchema
 */
function convertJsonToObjectSchema(jsonSchema: JSONSchema): Schema<any> {
  const { s } = require('../index');
  const properties: Record<string, Schema<any>> = {};
  
  // Convert each property
  if (jsonSchema.properties) {
    for (const [key, propSchema] of Object.entries(jsonSchema.properties)) {
      properties[key] = fromJsonSchema(propSchema);
    }
  }
  
  let schema = s.object(properties);
  
  // Handle required properties
  const required = jsonSchema.required || [];
  const optional = Object.keys(properties).filter(key => !required.includes(key));
  
  if (optional.length > 0) {
    schema = schema.optional(optional as any);
  }
  
  return schema;
}

// Add toJsonSchema method to Schema prototype
export function addJsonSchemaToSchema<T>(schema: Schema<T> & { toJsonSchema?: () => JSONSchema }): void {
  schema.toJsonSchema = function(): JSONSchema {
    return toJsonSchema(this);
  };
}

// Initialize extension
export function initJsonSchemaPlugin(): void {
  // Add toJsonSchema to Schema prototype
  addJsonSchemaToSchema(Schema.prototype);
  
  // Add fromJsonSchema to the main namespace
  const mainModule = require('../index');
  mainModule.s.fromJsonSchema = fromJsonSchema;
}