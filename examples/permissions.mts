import { s } from '../src';

/**
 * Exemple: Système de permissions RBAC
 */
function permissionsExample() {
  console.log('== Système de permissions ==');
  
  // 1. Définir un schéma d'utilisateur avec des champs restreints
  const UserSchema = s.object({
    id: s.string().uuid(),
    name: s.string(),
    email: s.string().email(),
    role: s.enum(['user', 'admin', 'manager']),
    // Champ visible uniquement par les admins
    salary: s.number().positive().restrict('admin'),
    // Champ avec condition de permission complexe
    securityClearance: s.string().restrict({
      role: ['admin', 'manager'],
      check: (context: { department: string; }) => context.department === 'security',
      message: 'Accès refusé: niveau de sécurité insuffisant'
    }),
    // Champ normal sans restriction
    joinDate: s.string(),
  })
    .withPermissions()
    .restrictField('salary', 'admin')
    .restrictField('securityClearance', {
      role: ['admin', 'manager'],
      check: (context: { department: string; }) => context.department === 'security',
      message: 'Accès refusé: niveau de sécurité insuffisant'
    });
  
  // Données utilisateur
  const userData = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'manager',
    salary: 75000,
    securityClearance: 'Level 3',
    joinDate: '2023-01-15',
  };
  
  // 2. Appliquer les permissions avec différents contextes
  console.log('\nUtilisateur régulier:');
  const userView = UserSchema.applyPermissions(userData, { role: 'user' });
  console.log(userView);
  // Résultat attendu: pas de salary ni securityClearance
  
  console.log('\nManager d\'un autre département:');
  const managerView = UserSchema.applyPermissions(userData, { 
    role: 'manager',
    department: 'finance' 
  });
  console.log(managerView);
  // Résultat attendu: pas de securityClearance mais avec salary
  
  console.log('\nAdmin du département de sécurité:');
  const adminView = UserSchema.applyPermissions(userData, { 
    role: 'admin',
    department: 'security' 
  });
  console.log(adminView);
  // Résultat attendu: accès complet à toutes les données
  
  // 3. Validation avec contexte de permission
  try {
    // Valider des données avec contexte utilisateur
    const validatedData = UserSchema.parse(userData, { 
      context: { role: 'user' } 
    });
    console.log('\nValidation réussie (utilisateur):', validatedData);
    
    // Cette validation échouera car un utilisateur tente d'accéder au champ 'salary'
    const restrictedData = {
      ...userData,
      salary: 80000 // Modification d'un champ restreint
    };
    
    UserSchema.parse(restrictedData, { 
      context: { role: 'user' },
      // Ne pas utiliser stripUnknown pour que les erreurs d'accès soient détectées
      stripUnknown: false
    });
    
    console.log('Cette ligne ne devrait pas s\'exécuter');
  } catch (error) {
    console.log('\nErreur de validation (comme prévu):', error.message);
  }
  
  // 4. Accès au champ sécurisé avec le bon contexte
  try {
    const securityData = UserSchema.parse(userData, {
      context: { 
        role: 'manager',
        department: 'security'
      }
    });
    console.log('\nValidation réussie (manager sécurité):', 
      'securityClearance =', securityData.securityClearance);
  } catch (error) {
    console.log('\nErreur inattendue:', error.message);
  }
}

/**
 * Exemple: API avec permissions
 */
function apiPermissionsExample() {
  console.log('\n== API avec permissions ==');
  
  // 1. Définir un schéma d'API pour une ressource
  const ArticleSchema = s.object({
    id: s.string(),
    title: s.string(),
    content: s.string(),
    // Seuls les auteurs et les admins peuvent voir les brouillons
    isDraft: s.boolean(),
    // Seuls les admins peuvent voir les statistiques
    stats: s.object({
      views: s.number(),
      likes: s.number(),
      comments: s.number()
    }),
    // Création et mise à jour
    createdAt: s.string(),
    updatedAt: s.string(),
    // Auteur - visible par tout le monde
    author: s.string()
  })
    .withPermissions()
    .restrictField('isDraft', ['admin', 'author'])
    .restrictField('stats', 'admin');
  
  // Les données d'un article
  const article = {
    id: 'article-123',
    title: 'Comprendre les permissions dans ts-smart-schema',
    content: 'Lorem ipsum dolor sit amet...',
    isDraft: true,
    stats: {
      views: 1250,
      likes: 42,
      comments: 7
    },
    createdAt: '2023-03-20T12:00:00Z',
    updatedAt: '2023-03-25T15:30:00Z',
    author: 'John Doe'
  };
  
  // 2. Simuler une API qui retourne des données selon le rôle
  function getArticle(id: string, userRole: string) {
    console.log(`\nRécupération de l'article ${id} avec le rôle ${userRole}`);
    
    // Récupérer l'article (simulé)
    const retrievedArticle = article;
    
    // Appliquer les permissions selon le rôle
    return ArticleSchema.applyPermissions(retrievedArticle, { role: userRole });
  }
  
  // 3. Tester avec différents rôles
  console.log(getArticle('article-123', 'visitor'));
  console.log(getArticle('article-123', 'author'));
  console.log(getArticle('article-123', 'admin'));
}

// Exécuter les exemples
permissionsExample();
apiPermissionsExample();