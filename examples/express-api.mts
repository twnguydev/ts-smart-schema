import { s, createExpressValidator, createRequestValidator } from '../src';

/**
 * Créer une API Express avec validation des schémas
 * 
 * Note: Ce code est un exemple et n'exécute pas réellement Express.
 * Il montre simplement comment utiliser les validateurs.
 */
function expressApiExample() {
  console.log('== Intégration Express ==');
  
  // Simuler l'objet Express
  const app = {
    use: (middleware: any) => console.log('Middleware global enregistré'),
    post: (path: string, ...handlers: any[]) => {
      console.log(`Route POST ${path} enregistrée avec ${handlers.length} handlers`);
    },
    get: (path: string, ...handlers: any[]) => {
      console.log(`Route GET ${path} enregistrée avec ${handlers.length} handlers`);
    },
    put: (path: string, ...handlers: any[]) => {
      console.log(`Route PUT ${path} enregistrée avec ${handlers.length} handlers`);
    },
    delete: (path: string, ...handlers: any[]) => {
      console.log(`Route DELETE ${path} enregistrée avec ${handlers.length} handlers`);
    }
  };
  
  // 1. Définir les schémas de validation
  const CreateUserSchema = s.object({
    id: s.string().uuid().optional(),
    name: s.string().min(2).max(50),
    email: s.string().email(),
    age: s.number().int().positive().optional(),
    password: s.string().min(8),
  });
  
  const UpdateUserSchema = CreateUserSchema.partial().required('id');
  
  const UserIdSchema = s.object({
    id: s.string().uuid()
  });
  
  const PaginationSchema = s.object({
    page: s.string().transform(value => parseInt(value, 10)).refine(value => value > 0, 'Page must be positive'),
    limit: s.string().transform(value => parseInt(value, 10)).refine(value => value > 0 && value <= 100, 'Limit must be between 1 and 100'),
    sort: s.string().optional(),
  });
  
  // 2. Créer des validateurs Express
  const validateCreateUser = createExpressValidator(CreateUserSchema);
  const validateUpdateUser = createExpressValidator(UpdateUserSchema);
  const validateUserId = createExpressValidator(UserIdSchema, 'params');
  const validatePagination = createExpressValidator(PaginationSchema, 'query');
  
  // 3. Créer un validateur combiné pour certaines routes
  const validateUserRequest = createRequestValidator({
    body: UpdateUserSchema,
    params: UserIdSchema,
  });
  
  // 4. Définir les gestionnaires de route (simulés)
  const createUser = (_req: any, _res: any) => {
    console.log('Créer un utilisateur');
  };
  
  const getUsers = (_req: any, _res: any) => {
    console.log('Obtenir la liste des utilisateurs');
  };
  
  const getUserById = (_req: any, _res: any) => {
    console.log('Obtenir un utilisateur par ID');
  };
  
  const updateUser = (_req: any, _res: any) => {
    console.log('Mettre à jour un utilisateur');
  };
  
  const deleteUser = (_req: any, _res: any) => {
    console.log('Supprimer un utilisateur');
  };
  
  // 5. Définir les routes avec validation
  app.post('/users', validateCreateUser, createUser);
  app.get('/users', validatePagination, getUsers);
  app.get('/users/:id', validateUserId, getUserById);
  app.put('/users/:id', validateUserRequest, updateUser);
  app.delete('/users/:id', validateUserId, deleteUser);
  
  // 6. Exemple d'utilisation d'un middleware d'erreur personnalisé
  const customErrorHandler = (err: any, _req: any, res: any, _next: any) => {
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: err.issues.map((issue: any) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    
    // Passer à l'erreur suivante
    _next(err);
  };
  
  // Ajouter le gestionnaire d'erreur
  app.use(customErrorHandler);
  
  // 7. Exemple de validation avec contexte (permissions)
  const UserRoleSchema = s.object({
    role: s.enum(['user', 'admin'])
  });
  
  const AdminOnlySchema = s.object({
    secretKey: s.string().min(8)
  }).restrict('admin');
  
  // Créer un validateur avec contexte
  const validateAdminAction = createExpressValidator(AdminOnlySchema, 'body', {
    context: { role: 'admin' }
  });
  
  // Middleware pour extraire le rôle de l'utilisateur du token
  const extractUserRole = (_req: any, _res: any, next: any) => {
    // Simuler l'extraction du rôle à partir d'un token JWT
    _req.userRole = 'admin';
    next();
  };
  
  // Route protégée par rôle
  app.post('/admin/actions', extractUserRole, validateAdminAction, (_req, _res) => {
    console.log('Action d\'administrateur');
  });
  
  console.log('\nRoutes d\'API avec validation:');
  console.log('- POST /users - Créer un utilisateur');
  console.log('- GET /users - Obtenir une liste paginée');
  console.log('- GET /users/:id - Obtenir un utilisateur spécifique');
  console.log('- PUT /users/:id - Mettre à jour un utilisateur');
  console.log('- DELETE /users/:id - Supprimer un utilisateur');
  console.log('- POST /admin/actions - Action d\'administrateur (protégée par rôle)');
}

/**
 * Simuler des requêtes HTTP pour tester les validateurs
 */
function simulateRequests() {
  console.log('\n== Simulation de requêtes ==');
  
  // Créer un utilisateur (valide)
  const validCreateRequest = {
    body: {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
      password: 'securepass123'
    }
  };
  
  // Créer un utilisateur (invalide)
  const invalidCreateRequest = {
    body: {
      name: 'J', // trop court
      email: 'not-an-email',
      age: -5, // négatif
      password: 'short' // trop court
    }
  };
  
  // Simuler une fonction de validation
  function validateRequest(schema: any, request: any) {
    try {
      const validated = schema.parse(request.body);
      console.log('✅ Validation réussie:', validated);
      return true;
    } catch (error) {
      console.log('❌ Erreur de validation:', error.message);
      return false;
    }
  }
  
  // Définir le schéma utilisateur
  const CreateUserSchema = s.object({
    name: s.string().min(2).max(50),
    email: s.string().email(),
    age: s.number().int().positive().optional(),
    password: s.string().min(8),
  });
  
  // Tester les validations
  console.log('\nRequête valide:');
  validateRequest(CreateUserSchema, validCreateRequest);
  
  console.log('\nRequête invalide:');
  validateRequest(CreateUserSchema, invalidCreateRequest);
}

// Exécuter les exemples
expressApiExample();
simulateRequests();