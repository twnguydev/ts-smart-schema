import { s } from '../index';

describe('Unions et intersections de schémas', () => {
  describe('Unions', () => {
    it('valide les unions de types primitifs', () => {
      // Pour l'exemple, nous définissons une fonction union qui n'existe pas encore
      // Vous devrez l'implémenter dans la bibliothèque
      const StringOrNumberSchema = s.union([
        s.string(),
        s.number()
      ]);

      expect(StringOrNumberSchema.parse('hello')).toBe('hello');
      expect(StringOrNumberSchema.parse(123)).toBe(123);
      expect(() => StringOrNumberSchema.parse(true)).toThrow();
    });

    it('valide les unions de schémas d\'objets', () => {
      const UserSchema = s.object({
        type: s.enum(['user']),
        name: s.string(),
        email: s.string().email(),
      });

      const AdminSchema = s.object({
        type: s.enum(['admin']),
        name: s.string(),
        permissions: s.array(s.string()),
      });

      const AccountSchema = s.union([UserSchema, AdminSchema]);

      const validUser = {
        type: 'user',
        name: 'John',
        email: 'john@example.com',
      };

      const validAdmin = {
        type: 'admin',
        name: 'Admin',
        permissions: ['read', 'write', 'delete'],
      };

      expect(AccountSchema.parse(validUser)).toEqual(validUser);
      expect(AccountSchema.parse(validAdmin)).toEqual(validAdmin);

      const invalidAccount = {
        type: 'moderator',
        name: 'Mod',
      };

      expect(() => AccountSchema.parse(invalidAccount)).toThrow();
    });

    it('utilise un discriminant pour les unions d\'objets', () => {
      const UserSchema = s.object({
        type: s.enum(['user']),
        name: s.string(),
        email: s.string().email(),
      });

      const AdminSchema = s.object({
        type: s.enum(['admin']),
        name: s.string(),
        permissions: s.array(s.string()),
      });

      // Pour l'exemple, supposons que discriminatedUnion existe
      const AccountSchema = s.discriminatedUnion('type', [
        UserSchema,
        AdminSchema,
      ]);

      const validUser = {
        type: 'user',
        name: 'John',
        email: 'john@example.com',
      };

      expect(AccountSchema.parse(validUser)).toEqual(validUser);

      const invalidAccount = {
        name: 'Invalid', // manque le discriminant 'type'
      };

      expect(() => AccountSchema.parse(invalidAccount)).toThrow();
    });
  });

  describe('Intersections', () => {
    it('combine des schémas d\'objets', () => {
      const PersonSchema = s.object({
        name: s.string(),
        age: s.number(),
      });

      const EmployeeSchema = s.object({
        company: s.string(),
        position: s.string(),
      });

      // Pour l'exemple, supposons que intersection existe
      const EmployeeWithPersonSchema = s.intersection(PersonSchema, EmployeeSchema);

      const validEmployeeWithPerson = {
        name: 'John',
        age: 30,
        company: 'Acme Inc',
        position: 'Developer',
      };

      expect(EmployeeWithPersonSchema.parse(validEmployeeWithPerson)).toEqual(validEmployeeWithPerson);

      const invalidObject = {
        name: 'John',
        position: 'Developer',
        // manque 'age' et 'company'
      };

      expect(() => EmployeeWithPersonSchema.parse(invalidObject)).toThrow();
    });
  });

  describe('Types récursifs', () => {
    it('valide des structures récursives comme des arbres', () => {
      // Définir un schéma récursif pour un nœud d'arbre
      const TreeNodeSchema: any = s.object({
        value: s.string(),
        children: s.lazy(() => s.array(TreeNodeSchema).default([])),
      });
    
      // Mise à jour de l'arbre valide pour inclure explicitement les tableaux vides
      const validTree = {
        value: 'root',
        children: [
          {
            value: 'child1',
            children: [
              { 
                value: 'grandchild1',
                children: []  // Ajout explicite du tableau vide
              },
              { 
                value: 'grandchild2',
                children: []  // Ajout explicite du tableau vide  
              },
            ],
          },
          {
            value: 'child2',
            children: []  // Ajout explicite du tableau vide
          },
        ],
      };
    
      expect(TreeNodeSchema.parse(validTree)).toEqual(validTree);
    
      // Tester les valeurs par défaut pour les enfants
      const nodeWithoutChildren = {
        value: 'leaf',
      };
    
      expect(TreeNodeSchema.parse(nodeWithoutChildren)).toEqual({
        value: 'leaf',
        children: [],
      });
    });

    it('valide des structures JSON-like récursives', () => {
      // Définir un schéma pour des valeurs JSON arbitraires
      const JsonValueSchema: any = s.union([
        s.string(),
        s.number(),
        s.boolean(),
        s.null(),
        s.lazy(() => s.array(JsonValueSchema)),
        s.lazy(() => s.record(s.string(), JsonValueSchema)),
      ]);

      const validJson = {
        string: 'value',
        number: 123,
        boolean: true,
        null: null,
        array: [1, 'string', true, { nested: 'object' }],
        object: {
          nested: {
            deeply: [1, 2, 3],
          },
        },
      };

      expect(JsonValueSchema.parse(validJson)).toEqual(validJson);
    });
  });
});