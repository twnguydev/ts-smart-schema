# TypeScript Smart Schema

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![npm](https://img.shields.io/npm/v/ts-smart-schema)

A powerful schema validation and transformation library for TypeScript that combines the ease of use of modern validation libraries with advanced type transformations and bidirectional validation.

## 🌟 Features

- **Bidirectional Validation** - Validate both input and output with the same schema
- **Transformation History** - Keep track of transformations and revert back to previous states
- **Partial Validations** - Generate partial schemas for updates with full type safety
- **Protocol Support** - Native conversions to/from JSON Schema, GraphQL, Protobuf
- **High Performance** - Optimized runtime with schema compilation options
- **First-class TypeScript** - Designed from the ground up for TypeScript, not just typed JavaScript
- **Zero Dependencies** - Lightweight core with optional plugins for extended functionality

## 🚀 Quick Start

```bash
npm install ts-smart-schema
# or
yarn add ts-smart-schema
```

## 📋 Basic Usage

```typescript
import { s } from 'ts-smart-schema';

// Define your schema
const UserSchema = s.object({
  id: s.string().uuid(),
  name: s.string().min(2).max(50),
  email: s.string().email(),
  age: s.number().int().positive().optional(),
  roles: s.array(s.enum(['admin', 'user', 'guest'])),
  metadata: s.record(s.string(), s.any()).default({}),
});

// Type inference
type User = s.InferType<typeof UserSchema>;

// Validation
const result = UserSchema.parse({
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'John Doe',
  email: 'john@example.com',
  roles: ['user'],
});

if (result.isOk()) {
  // Typed as User
  const user = result.unwrap();
  console.log(user.name); // John Doe
} else {
  // Detailed error information
  console.error(result.unwrapErr());
}
```

## 🔄 Bidirectional Validation

```typescript
const ApiUserSchema = s.object({
  user_id: s.string(),
  user_name: s.string(),
  user_email: s.string(),
});

const UserSchema = s.object({
  id: s.string(),
  name: s.string(),
  email: s.string(),
});

// Create a bidirectional mapping
const mapping = s.biMap(UserSchema, ApiUserSchema, {
  // Define mapping rules
  to: {
    user_id: (user) => user.id,
    user_name: (user) => user.name,
    user_email: (user) => user.email,
  },
  from: {
    id: (apiUser) => apiUser.user_id,
    name: (apiUser) => apiUser.user_name,
    email: (apiUser) => apiUser.user_email,
  },
});

// Convert from User to ApiUser
const apiUser = mapping.to(user);

// Convert from ApiUser to User
const userFromApi = mapping.from(apiResponse);
```

## 📜 Transformation History

```typescript
const schema = s.object({
  name: s.string(),
  data: s.record(s.string(), s.any()),
});

// Create a versioned instance
const versioned = schema.createVersioned({
  name: "Original",
  data: { count: 1 }
});

// Apply transformations
versioned.transform((data) => {
  data.name = "Modified";
  data.data.count += 1;
});

console.log(versioned.current);  // { name: "Modified", data: { count: 2 } }

// Revert to previous state
versioned.revert();
console.log(versioned.current);  // { name: "Original", data: { count: 1 } }

// Check available versions
console.log(versioned.history.length);  // 2
```

## 🧩 Partial Schemas

```typescript
const UserSchema = s.object({
  id: s.string().uuid(),
  name: s.string().min(2),
  email: s.string().email(),
  age: s.number().int(),
});

// Generate a partial schema for updates
const UserUpdateSchema = UserSchema.partial()
  // Make ID required even in partial schema
  .required('id');

// Type is { id: string, name?: string, email?: string, age?: number }
type UserUpdate = s.InferType<typeof UserUpdateSchema>;

// Valid partial update
const result = UserUpdateSchema.parse({
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'New Name',
});
```

## 📐 Protocol Support

```typescript
// Convert to JSON Schema
const jsonSchema = UserSchema.toJsonSchema();

// Generate GraphQL type definitions
const graphqlTypes = UserSchema.toGraphQL('User');

// Generate Protobuf definitions
const protobufDef = UserSchema.toProtobuf('User');

// Parse from JSON Schema
const schemaFromJson = s.fromJsonSchema(jsonSchemaObject);
```

## ⚙️ Advanced Features

### Custom Types

```typescript
const EmailSchema = s.custom<string>((value) => {
  if (typeof value !== 'string') return s.error('Must be a string');
  if (!value.includes('@')) return s.error('Invalid email format');
  return s.ok(value);
});

// Add methods to your custom types
const RangeSchema = s.number()
  .extend({
    between(min: number, max: number) {
      return this.refine(
        value => value >= min && value <= max,
        `Must be between ${min} and ${max}`
      );
    }
  });

const validatedNumber = RangeSchema.between(1, 10).parse(5);
```

### Schema Compilation

```typescript
// Compile schema for maximum performance
const compiledSchema = UserSchema.compile();

// ~2-5x faster validation for repeated use
const result = compiledSchema.parse(data);
```

### Composable Validation Rules

```typescript
// Create reusable validation rules
const nameRules = s.rules.string()
  .trim()
  .min(2)
  .max(50)
  .regex(/^[a-zA-Z\s-]+$/);

// Use in multiple schemas
const UserSchema = s.object({
  name: s.string().apply(nameRules),
  // ...
});

const ProductSchema = s.object({
  productName: s.string().apply(nameRules),
  // ...
});
```

## 🔍 Comparison with Other Libraries

| Feature | ts-smart-schema | Zod | Yup | io-ts |
|---------|----------------|-----|-----|-------|
| TypeScript First | ✅ | ✅ | ❌ | ✅ |
| Bidirectional Validation | ✅ | ❌ | ❌ | ❌ |
| Transformation History | ✅ | ❌ | ❌ | ❌ |
| Partial Schemas | ✅ | ✅ | ✅ | ❌ |
| Protocol Support | ✅ | ❌ | ❌ | ❌ |
| Schema Compilation | ✅ | ❌ | ❌ | ✅ |
| Bundle Size | Small | Medium | Large | Small |

## 📚 Documentation

A detailed documentation will be released soon.

## 🧪 Testing

```bash
npm test
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.