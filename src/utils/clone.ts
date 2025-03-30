/**
 * Deep clone an object or value
 */
export function deepClone<T>(value: T): T {
  // Handle primitive types
  if (value === null || typeof value !== 'object') {
    return value;
  }
  
  // Handle Date objects
  if (value instanceof Date) {
    return new Date(value.getTime()) as unknown as T;
  }
  
  // Handle Array objects
  if (Array.isArray(value)) {
    return value.map(item => deepClone(item)) as unknown as T;
  }
  
  // Handle regular objects
  if (Object.getPrototypeOf(value) === Object.prototype) {
    const result: Record<string, any> = {};
    
    for (const key of Object.keys(value)) {
      result[key] = deepClone((value as Record<string, any>)[key]);
    }
    
    return result as T;
  }
  
  // For other objects (Map, Set, etc.), try to serialize/deserialize
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (e) {
    // If serialization fails, return a shallow copy as a fallback
    return { ...value };
  }
}