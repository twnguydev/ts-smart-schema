import { s } from '../src';

/**
 * Exemple d'utilisation des schémas génériques
 */
function genericSchemasExample() {
  console.log('== Schémas génériques ==');
  
  // 1. Créer un schéma de base pour un utilisateur
  const UserSchema = s.object({
    id: s.string().uuid(),
    name: s.string().min(2).max(50),
    email: s.string().email(),
  });
  
  // 2. Créer un schéma de réponse API générique
  const UserResponseSchema = s.apiResponse(UserSchema);
  
  console.log('\nSchéma de réponse API générique:');
  
  // Données de test
  const apiResponse = {
    success: true,
    data: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Doe',
      email: 'john@example.com',
    },
  };
  
  try {
    const validatedResponse = UserResponseSchema.parse(apiResponse);
    console.log('Réponse API validée:', validatedResponse.success);
  } catch (error) {
    console.error('Erreur de validation:', error.message);
  }
  
  // 3. Créer un schéma de pagination générique
  const PaginatedUsersSchema = s.paginated(UserSchema);
  
  console.log('\nSchéma de pagination générique:');
  
  // Données de test
  const paginationResponse = {
    items: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
      },
      {
        id: '223e4567-e89b-12d3-a456-426614174000',
        name: 'Jane Smith',
        email: 'jane@example.com',
      }
    ],
    total: 2,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  };
  
  try {
    const validatedPagination = PaginatedUsersSchema.parse(paginationResponse);
    console.log(`Pagination validée: ${validatedPagination.items.length} éléments`);
  } catch (error) {
    console.error('Erreur de validation:', error.message);
  }
  
  // 4. Créer un schéma de dictionnaire générique
  const UserMapSchema = s.record(s.string().uuid(), UserSchema);
  
  console.log('\nSchéma de dictionnaire générique:');
  
  // Données de test
  const userMap = {
    '123e4567-e89b-12d3-a456-426614174000': {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Doe',
      email: 'john@example.com',
    },
    '223e4567-e89b-12d3-a456-426614174000': {
      id: '223e4567-e89b-12d3-a456-426614174000',
      name: 'Jane Smith',
      email: 'jane@example.com',
    },
  };
  
  try {
    const validatedMap = UserMapSchema.parse(userMap);
    console.log(`Dictionnaire validé: ${Object.keys(validatedMap).length} éléments`);
  } catch (error) {
    console.error('Erreur de validation:', error.message);
  }
  
  // 5. Créer un schéma d'union
  const AdminSchema = s.object({
    id: s.string().uuid(),
    name: s.string().min(2).max(50),
    email: s.string().email(),
    accessLevel: s.number().int().min(1).max(5),
    permissions: s.array(s.string()),
  });
  
  const GuestSchema = s.object({
    id: s.string().uuid(),
    name: s.string().min(2).max(50),
    email: s.string().email(),
    expiresAt: s.string(), // Date d'expiration
  });
  
  const PersonSchema = s.union([UserSchema, AdminSchema, GuestSchema]);
  
  console.log('\nSchéma d\'union générique:');
  
  // Données de test
  const adminData = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Admin User',
    email: 'admin@example.com',
    accessLevel: 5,
    permissions: ['read', 'write', 'delete'],
  };
  
  try {
    const validatedAdmin = PersonSchema.parse(adminData);
    console.log('Union validée (admin):', validatedAdmin.name);
    
    // Test avec un type incompatible
    const invalidData = {
      id: 'not-a-uuid',
      name: 'Invalid Person',
    };
    
    PersonSchema.parse(invalidData);
  } catch (error) {
    console.log('Erreur de validation attendue pour l\'union:', error.message.substring(0, 50) + '...');
  }
  
  // 6. Créer un schéma d'union discriminée
  const UserTypeSchema = s.object({
    type: s.enum(['regular']),
    id: s.string().uuid(),
    name: s.string().min(2).max(50),
    email: s.string().email(),
  });
  
  const AdminTypeSchema = s.object({
    type: s.enum(['admin']),
    id: s.string().uuid(),
    name: s.string().min(2).max(50),
    email: s.string().email(),
    permissions: s.array(s.string()),
  });
  
  const GuestTypeSchema = s.object({
    type: s.enum(['guest']),
    id: s.string().uuid(),
    name: s.string().min(2).max(50),
    expiresAt: s.string(),
  });
  
  const PersonTypeSchema = s.discriminatedUnion('type', [
    UserTypeSchema,
    AdminTypeSchema,
    GuestTypeSchema,
  ]);
  
  console.log('\nSchéma d\'union discriminée:');
  
  // Données de test
  const userWithType = {
    type: 'regular',
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'John Doe',
    email: 'john@example.com',
  };
  
  try {
    const validatedUserWithType = PersonTypeSchema.parse(userWithType);
    console.log('Union discriminée validée:', validatedUserWithType.type);
    
    // Test avec un discriminant invalide
    const invalidType = {
      type: 'unknown',
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Invalid Type',
    };
    
    PersonTypeSchema.parse(invalidType);
  } catch (error) {
    console.log('Erreur attendue pour le discriminant:', error.message);
  }
  
  // 7. Créer un schéma récursif avec lazy
  type TreeNode = {
    value: string;
    children?: TreeNode[];
  };
  
  const TreeNodeSchema: any = s.object({
    value: s.string(),
    children: s.lazy(() => s.array(TreeNodeSchema).optional()),
  });
  
  console.log('\nSchéma récursif avec lazy:');
  
  // Données de test
  const treeData = {
    value: 'root',
    children: [
      {
        value: 'child1',
        children: [
          { value: 'grandchild1' },
          { value: 'grandchild2' },
        ]
      },
      { value: 'child2' },
    ]
  };
  
  try {
    const validatedTree = TreeNodeSchema.parse(treeData);
    console.log('Arbre validé avec une profondeur de 3 niveaux');
    console.log(`Nœud racine: ${validatedTree.value}`);
    console.log(`Premier enfant: ${validatedTree.children[0].value}`);
    console.log(`Premier petit-enfant: ${validatedTree.children[0].children[0].value}`);
  } catch (error) {
    console.error('Erreur de validation:', error.message);
  }
  
  // 8. Créer un schéma d'intersection
  const WithTimestampsSchema = s.object({
    createdAt: s.string(),
    updatedAt: s.string().optional(),
  });
  
  const UserWithTimestampsSchema = s.intersection(UserSchema, WithTimestampsSchema);
  
  console.log('\nSchéma d\'intersection:');
  
  // Données de test
  const userWithTimestamps = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'John Doe',
    email: 'john@example.com',
    createdAt: '2023-01-15T12:00:00Z',
    updatedAt: '2023-01-20T15:30:00Z',
  };
  
  try {
    const validatedIntersection = UserWithTimestampsSchema.parse(userWithTimestamps);
    console.log('Intersection validée:', 
      `${validatedIntersection.name} (créé le ${validatedIntersection.createdAt})`);
      
    // Test avec des données incomplètes
    const incompleteData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John Doe',
      email: 'john@example.com',
      // Manque createdAt
    };
    
    UserWithTimestampsSchema.parse(incompleteData);
  } catch (error) {
    console.log('Erreur attendue pour l\'intersection:', error.message);
  }
}

// Exécuter l'exemple
genericSchemasExample();