import { s } from '../index';

describe('Transformations de données', () => {
  describe('Transformations simples', () => {
    it('convertit les types primitifs', () => {
      // Pour l'exemple, supposons que le schéma ait une méthode transform
      const NumberAsStringSchema = s.string().transform((value) => parseInt(value, 10));

      expect(NumberAsStringSchema.parse('123')).toBe(123);
      expect(() => NumberAsStringSchema.parse('abc')).toThrow();
    });

    it('transforme et valide', () => {
      const PositiveNumberSchema = s.string()
        .transform((value) => {
          const num = parseInt(value, 10);
          if (isNaN(num)) throw new Error('Not a number');
          return num;
        })
        .refine((value) => value > 0, 'Must be positive');

      expect(PositiveNumberSchema.parse('123')).toBe(123);
      expect(() => PositiveNumberSchema.parse('-5')).toThrow();
      expect(() => PositiveNumberSchema.parse('abc')).toThrow();
    });
  });

  describe('Transformations d\'objets', () => {
    it('transforme les objets', () => {
      const UserSchema = s.object({
        firstName: s.string(),
        lastName: s.string(),
      }).transform((user) => ({
        ...user,
        fullName: `${user.firstName} ${user.lastName}`,
      }));

      const result = UserSchema.parse({
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
      });
    });

    it('applique plusieurs transformations en chaîne', () => {
      const DateSchema = s.string()
        .refine((value) => {
          const date = new Date(value);
          return !isNaN(date.getTime());
        }, "Invalid date string")
        .transform((value) => new Date(value))
        .transform((date) => ({
          date,
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate(),
        }));

      const result = DateSchema.parse('2023-05-15');
      
      expect(result.year).toBe(2023);
      expect(result.month).toBe(5);
      expect(result.day).toBe(15);
      expect(result.date).toBeInstanceOf(Date);
    });
  });

  describe('Préprocessing et postprocessing', () => {
    it('prétraite les données avant validation', () => {
      const TrimmedStringSchema = s.string()
        .preprocess((value) => typeof value === 'string' ? value.trim() : value)
        .min(3);

      expect(TrimmedStringSchema.parse('   hello   ')).toBe('hello');
      expect(() => TrimmedStringSchema.parse('   hi   ')).toThrow();
    });

    it('posttraite les données après validation', () => {
      const UserWithCreatedAtSchema = s.object({
        name: s.string(),
        email: s.string().email(),
      }).postprocess((user) => ({
        ...user,
        createdAt: new Date(),
      }));

      const result = UserWithCreatedAtSchema.parse({
        name: 'John',
        email: 'john@example.com',
      });

      expect(result.name).toBe('John');
      expect(result.email).toBe('john@example.com');
      expect(result.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('Cas d\'utilisation avancés', () => {
    it('transforme des dates en chaînes ISO et vice-versa', () => {
      const DateSchema = s.union([
        s.string().transform((str) => new Date(str)),
        s.number().transform((timestamp) => new Date(timestamp)),
        s.instanceof(Date)
      ]);

      const IsoDateStringSchema = s.instanceof(Date)
        .transform((date) => date.toISOString());

      // String to Date
      const dateFromString = DateSchema.parse('2023-05-15T12:00:00Z');
      expect(dateFromString).toBeInstanceOf(Date);
      expect(dateFromString.getUTCFullYear()).toBe(2023);

      // Timestamp to Date
      const dateFromTimestamp = DateSchema.parse(1684152000000); // 2023-05-15T12:00:00Z
      expect(dateFromTimestamp).toBeInstanceOf(Date);

      // Date to ISO string
      const isoString = IsoDateStringSchema.parse(new Date('2023-05-15T12:00:00Z'));
      expect(isoString).toBe('2023-05-15T12:00:00.000Z');
    });

    it('transforme des objets en modèles de domaine', () => {
      // Definir une classe de modèle
      class User {
        constructor(
          public id: string,
          public name: string,
          public email: string,
          public createdAt: Date
        ) {}

        greet() {
          return `Hello, ${this.name}!`;
        }
      }

      const UserSchema = s.object({
        id: s.string(),
        name: s.string(),
        email: s.string().email(),
        createdAt: s.union([
          s.string(),
          s.number(),
          s.instanceof(Date)
        ]),
      }).transform((data) => {
        const createdAt = data.createdAt instanceof Date
          ? data.createdAt
          : new Date(data.createdAt);
        
        return new User(
          data.id,
          data.name,
          data.email,
          createdAt
        );
      });

      const userData = {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: '2023-05-15T12:00:00Z',
      };

      const user = UserSchema.parse(userData);
      expect(user).toBeInstanceOf(User);
      expect(user.id).toBe('123');
      expect(user.greet()).toBe('Hello, John Doe!');
    });
  });
});