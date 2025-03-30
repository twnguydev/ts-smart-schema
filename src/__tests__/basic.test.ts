import { s } from '../index';

describe('Basic Schema Validation', () => {
  describe('StringSchema', () => {
    it('validates basic strings', () => {
      const schema = s.string();
      expect(schema.parse('hello')).toBe('hello');
      expect(() => schema.parse(123)).toThrow();
    });
    
    it('validates with min length', () => {
      const schema = s.string().min(3);
      expect(schema.parse('hello')).toBe('hello');
      expect(() => schema.parse('hi')).toThrow();
    });
    
    it('validates with max length', () => {
      const schema = s.string().max(5);
      expect(schema.parse('hello')).toBe('hello');
      expect(() => schema.parse('hello world')).toThrow();
    });
    
    it('validates with regex', () => {
      const schema = s.string().regex(/^[a-z]+$/);
      expect(schema.parse('hello')).toBe('hello');
      expect(() => schema.parse('Hello123')).toThrow();
    });
    
    it('validates email format', () => {
      const schema = s.string().email();
      expect(schema.parse('user@example.com')).toBe('user@example.com');
      expect(() => schema.parse('not-an-email')).toThrow();
    });
    
    it('trims whitespace when requested', () => {
      const schema = s.string().trim();
      expect(schema.parse('  hello  ')).toBe('hello');
    });
  });
  
  describe('NumberSchema', () => {
    it('validates basic numbers', () => {
      const schema = s.number();
      expect(schema.parse(123)).toBe(123);
      expect(() => schema.parse('123')).toThrow();
    });
    
    it('validates with min value', () => {
      const schema = s.number().min(10);
      expect(schema.parse(15)).toBe(15);
      expect(() => schema.parse(5)).toThrow();
    });
    
    it('validates with max value', () => {
      const schema = s.number().max(10);
      expect(schema.parse(5)).toBe(5);
      expect(() => schema.parse(15)).toThrow();
    });
    
    it('validates integers', () => {
      const schema = s.number().int();
      expect(schema.parse(5)).toBe(5);
      expect(() => schema.parse(5.5)).toThrow();
    });
    
    it('validates positive numbers', () => {
      const schema = s.number().positive();
      expect(schema.parse(5)).toBe(5);
      expect(() => schema.parse(0)).toThrow();
      expect(() => schema.parse(-5)).toThrow();
    });
    
    it('validates negative numbers', () => {
      const schema = s.number().negative();
      expect(schema.parse(-5)).toBe(-5);
      expect(() => schema.parse(0)).toThrow();
      expect(() => schema.parse(5)).toThrow();
    });
  });
  
  describe('ObjectSchema', () => {
    it('validates basic objects', () => {
      const schema = s.object({
        name: s.string(),
        age: s.number(),
      });
      
      expect(schema.parse({ name: 'John', age: 30 })).toEqual({ name: 'John', age: 30 });
      expect(() => schema.parse({ name: 'John' })).toThrow();
      expect(() => schema.parse({ name: 'John', age: '30' })).toThrow();
    });
    
    it('allows optional properties', () => {
      const schema = s.object({
        name: s.string(),
        age: s.number(),
      }).optional('age');
      
      expect(schema.parse({ name: 'John', age: 30 })).toEqual({ name: 'John', age: 30 });
      expect(schema.parse({ name: 'John' })).toEqual({ name: 'John' });
    });
    
    it('creates partial schemas', () => {
      const schema = s.object({
        name: s.string(),
        age: s.number(),
      }).partial();
      
      expect(schema.parse({})).toEqual({});
      expect(schema.parse({ name: 'John' })).toEqual({ name: 'John' });
      expect(schema.parse({ age: 30 })).toEqual({ age: 30 });
      expect(() => schema.parse({ age: '30' })).toThrow();
    });
    
    it('allows required fields in partial schemas', () => {
      const schema = s.object({
        id: s.string(),
        name: s.string(),
        age: s.number(),
      }).partial().required('id');
      
      expect(schema.parse({ id: 'abc' })).toEqual({ id: 'abc' });
      expect(() => schema.parse({})).toThrow();
    });
  });
  
  describe('ArraySchema', () => {
    it('validates basic arrays', () => {
      const schema = s.array(s.string());
      
      expect(schema.parse(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
      expect(() => schema.parse([1, 2, 3])).toThrow();
    });
    
    it('validates with min items', () => {
      const schema = s.array(s.string()).min(2);
      
      expect(schema.parse(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
      expect(() => schema.parse(['a'])).toThrow();
    });
    
    it('validates with max items', () => {
      const schema = s.array(s.string()).max(2);
      
      expect(schema.parse(['a', 'b'])).toEqual(['a', 'b']);
      expect(() => schema.parse(['a', 'b', 'c'])).toThrow();
    });
    
    it('validates unique items', () => {
      const schema = s.array(s.string()).unique();
      
      expect(schema.parse(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
      expect(() => schema.parse(['a', 'b', 'a'])).toThrow();
    });
  });
  
  describe('EnumSchema', () => {
    it('validates enum values', () => {
      const schema = s.enum(['red', 'green', 'blue'] as const);
      
      expect(schema.parse('red')).toBe('red');
      expect(schema.parse('green')).toBe('green');
      expect(schema.parse('blue')).toBe('blue');
      expect(() => schema.parse('yellow')).toThrow();
    });
  });
  
  describe('Result type', () => {
    it('handles success results', () => {
      const result = s.ok(42);
      
      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);
      expect(result.unwrap()).toBe(42);
      expect(result.unwrapOr(0)).toBe(42);
      expect(() => result.unwrapErr()).toThrow();
    });
    
    it('handles error results', () => {
      const error = new Error('Something went wrong');
      const result = s.error(error);
      
      expect(result.isOk()).toBe(false);
      expect(result.isErr()).toBe(true);
      expect(() => result.unwrap()).toThrow();
      expect(result.unwrapOr(42)).toBe(42);
      expect(result.unwrapErr()).toBe(error);
    });
    
    it('allows mapping of values', () => {
      const result = s.ok(2);
      const mapped = result.map(x => x * 2);
      
      expect(mapped.isOk()).toBe(true);
      expect(mapped.unwrap()).toBe(4);
    });
    
    it('allows chaining with andThen', () => {
      const result = s.ok(2);
      const chained = result.andThen(x => s.ok(x * 2));
      
      expect(chained.isOk()).toBe(true);
      expect(chained.unwrap()).toBe(4);
    });
  });
});