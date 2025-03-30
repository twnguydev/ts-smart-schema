import { s, ValidationError } from '../index';

describe('Advanced Schema Validation', () => {
  describe('Schémas composés', () => {
    it('valide un objet avec des champs imbriqués', () => {
      const AddressSchema = s.object({
        street: s.string(),
        city: s.string(),
        zipCode: s.string().regex(/^\d{5}$/),
        country: s.string(),
      });

      const UserSchema = s.object({
        name: s.string(),
        email: s.string().email(),
        address: AddressSchema,
      });

      const validUser = {
        name: 'John Doe',
        email: 'john@example.com',
        address: {
          street: '123 Main St',
          city: 'Anytown',
          zipCode: '12345',
          country: 'USA',
        },
      };

      expect(UserSchema.parse(validUser)).toEqual(validUser);

      const invalidUser = {
        name: 'John Doe',
        email: 'john@example.com',
        address: {
          street: '123 Main St',
          city: 'Anytown',
          zipCode: '123', // Invalid zip code
          country: 'USA',
        },
      };

      expect(() => UserSchema.parse(invalidUser)).toThrow();
    });

    it('valide un tableau d\'objets', () => {
      const PostSchema = s.object({
        id: s.string(),
        title: s.string().min(3),
        content: s.string(),
      });

      const PostsSchema = s.array(PostSchema);

      const validPosts = [
        { id: '1', title: 'First Post', content: 'Hello world' },
        { id: '2', title: 'Second Post', content: 'Content here' },
      ];

      expect(PostsSchema.parse(validPosts)).toEqual(validPosts);

      const invalidPosts = [
        { id: '1', title: 'First Post', content: 'Hello world' },
        { id: '2', title: 'Se', content: 'Content here' }, // Title too short
      ];

      expect(() => PostsSchema.parse(invalidPosts)).toThrow();
    });
  });

  describe('Raffinements personnalisés', () => {
    it('applique des validations personnalisées', () => {
      const EvenNumberSchema = s.number().refine(
        (n) => n % 2 === 0,
        'Le nombre doit être pair'
      );

      expect(EvenNumberSchema.parse(2)).toBe(2);
      expect(EvenNumberSchema.parse(4)).toBe(4);
      expect(() => EvenNumberSchema.parse(3)).toThrow('Le nombre doit être pair');
    });

    it('applique des validations avec message dynamique', () => {
      const MinMaxSchema = s.number().refine(
        (n) => n >= 1 && n <= 10,
        (n) => `${n} doit être compris entre 1 et 10`
      );

      expect(MinMaxSchema.parse(5)).toBe(5);
      expect(() => MinMaxSchema.parse(20)).toThrow('20 doit être compris entre 1 et 10');
    });
  });

  describe('Schémas partiels', () => {
    it('génère correctement un schéma partiel profond', () => {
      const UserSchema = s.object({
        id: s.string(),
        name: s.string(),
        profile: s.object({
          bio: s.string(),
          avatar: s.string().optional(),
          settings: s.object({
            theme: s.enum(['light', 'dark']),
            notifications: s.boolean(),
          }),
        }),
      });

      const PartialUserSchema = UserSchema.partial();

      const validPartial = {
        id: '123',
        profile: {
          settings: {
            theme: 'dark',
          },
        },
      };

      expect(PartialUserSchema.parse(validPartial)).toEqual(validPartial);
    });
  });

  describe('Validation bidirectionnelle', () => {
    it('convertit des données entre formats différents', () => {
      const ApiUserSchema = s.object({
        user_id: s.string(),
        user_name: s.string(),
        is_active: s.boolean(),
      });

      const DomainUserSchema = s.object({
        id: s.string(),
        name: s.string(),
        active: s.boolean(),
      });

      const mapping = s.biMap(DomainUserSchema, ApiUserSchema, {
        to: {
          user_id: (user) => user.id,
          user_name: (user) => user.name,
          is_active: (user) => user.active,
        },
        from: {
          id: (apiUser) => apiUser.user_id,
          name: (apiUser) => apiUser.user_name,
          active: (apiUser) => apiUser.is_active,
        },
      });

      const domainUser = {
        id: '123',
        name: 'John',
        active: true,
      };

      const apiUser = {
        user_id: '123',
        user_name: 'John',
        is_active: true,
      };

      const convertedToApi = mapping.to(domainUser).unwrap();
      expect(convertedToApi).toEqual(apiUser);

      const convertedToDomain = mapping.from(apiUser).unwrap();
      expect(convertedToDomain).toEqual(domainUser);
    });
  });

  describe('Versionnement des données', () => {
    it('crée et manipule correctement des versions de données', () => {
      const UserSchema = s.object({
        id: s.string(),
        name: s.string(),
        email: s.string(),
        age: s.number(),
      });

      const initialData = {
        id: '123',
        name: 'Initial',
        email: 'initial@example.com',
        age: 25,
      };

      const versioned = UserSchema.createVersioned(initialData);
      expect(versioned.current).toEqual(initialData);

      // 1ère transformation
      versioned.transform((data) => {
        data.name = 'Updated';
        data.age = 26;
      }, 'Première mise à jour');

      expect(versioned.current).toEqual({
        ...initialData,
        name: 'Updated',
        age: 26,
      });

      // 2ème transformation
      versioned.transform((data) => {
        data.email = 'updated@example.com';
      }, 'Deuxième mise à jour');

      expect(versioned.current).toEqual({
        id: '123',
        name: 'Updated',
        email: 'updated@example.com',
        age: 26,
      });

      // Revenir en arrière
      versioned.revert();
      expect(versioned.current).toEqual({
        ...initialData,
        name: 'Updated',
        age: 26,
      });

      // Avancer à nouveau
      versioned.redo();
      expect(versioned.current).toEqual({
        id: '123',
        name: 'Updated',
        email: 'updated@example.com',
        age: 26,
      });

      // Vérifier l'historique
      expect(versioned.history.length).toBe(3);
      expect(versioned.history[0].label).toBeUndefined();
      expect(versioned.history[1].label).toBe('Première mise à jour');
      expect(versioned.history[2].label).toBe('Deuxième mise à jour');
    });
  });

  describe('Gestion des erreurs', () => {
    it('collecte toutes les erreurs de validation', () => {
      const ComplexSchema = s.object({
        name: s.string().min(3),
        age: s.number().int().positive(),
        email: s.string().email(),
        tags: s.array(s.string().min(2)).min(1),
      });

      const invalidData = {
        name: 'Jo', // trop court
        age: -5, // négatif
        email: 'invalid-email', // pas un email
        tags: ['a'], // un tag trop court
      };

      const result = ComplexSchema.safeParse(invalidData);
      expect(result.isOk()).toBe(false);

      if (result.isErr()) {
        const error = result.unwrapErr();
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.issues.length).toBeGreaterThan(1);
        
        // Vérifier que les chemins sont corrects
        const paths = error.issues.map(issue => issue.path.join('.'));
        expect(paths).toContain('name');
        expect(paths).toContain('age');
        expect(paths).toContain('email');
        expect(paths.some(p => p.startsWith('tags'))).toBe(true);
      }
    });

    it('s\'arrête à la première erreur avec abortEarly', () => {
      const UserSchema = s.object({
        name: s.string().min(3),
        age: s.number().positive(),
        email: s.string().email(),
      });

      const invalidData = {
        name: 'Jo', // trop court
        age: -5, // négatif
        email: 'invalid-email', // pas un email
      };

      const result = UserSchema.safeParse(invalidData, { abortEarly: true });
      expect(result.isOk()).toBe(false);

      if (result.isErr()) {
        const error = result.unwrapErr();
        expect(error.issues.length).toBe(1);
        expect(error.issues[0].path).toContain('name');
      }
    });
  });

  describe('Valeurs par défaut', () => {
    it('applique les valeurs par défaut', () => {
      const SettingsSchema = s.object({
        theme: s.string().default('light'),
        fontSize: s.number().default(14),
        notifications: s.boolean().default(true),
      });

      expect(SettingsSchema.parse({})).toEqual({
        theme: 'light',
        fontSize: 14,
        notifications: true,
      });

      expect(SettingsSchema.parse({ theme: 'dark' })).toEqual({
        theme: 'dark',
        fontSize: 14,
        notifications: true,
      });
    });
  });
});