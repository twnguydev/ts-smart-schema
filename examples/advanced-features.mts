import { s } from '../src';

/**
 * Exemple 1: Validation contextuelle
 */
function contextualValidationExample() {
  console.log('== Validation contextuelle ==');
  
  // Schéma qui change selon le contexte
  const UserSchema = s.object({
    name: s.string().min(2),
    email: s.string(),
    role: s.enum(['user', 'admin', 'guest']),
    // L'âge est optionnel par défaut, mais obligatoire en mode "strict"
    age: s.number().int().whenContext('strict', schema => schema.refine(
      value => value !== undefined,
      'Age is required in strict mode'
    )),
    // Le mot de passe est validé différemment selon le contexte
    password: s.string().whenContext('strict', schema => schema.min(8))
                       .whenContext('basic', schema => schema.min(4)),
  });
  
  // Données d'exemple
  const userData = {
    name: 'John',
    email: 'john@example.com',
    role: 'user',
    password: 'pass',
  };
  
  try {
    // Validation en mode normal - passe
    const normalUser = UserSchema.parse(userData);
    console.log('Validation normale réussie:', normalUser);
    
    // Validation en mode "basic" - échoue car mot de passe trop court
    const basicUser = UserSchema.parse(userData, { context: 'basic' });
    console.log('Validation basic réussie:', basicUser);
  } catch (error) {
    console.error('Erreur de validation en mode basic:', error);
  }
  
  try {
    // Validation en mode "strict" - échoue car age manquant
    const strictUser = UserSchema.parse(userData, { context: 'strict' });
    console.log('Validation stricte réussie:', strictUser);
  } catch (error) {
    console.error('Erreur de validation en mode strict:', error);
  }
  
  // Ajout de l'âge et renforcement du mot de passe pour le mode strict
  const strictUserData = {
    ...userData,
    age: 30,
    password: 'strongPassword123',
  };
  
  try {
    // Validation en mode "strict" avec les données appropriées
    const strictUser = UserSchema.parse(strictUserData, { context: 'strict' });
    console.log('Validation stricte réussie avec données appropriées:', strictUser);
  } catch (error) {
    console.error('Erreur inattendue:', error);
  }
}

/**
 * Exemple 2: Transformations avancées
 */
function transformationExample() {
  console.log('\n== Transformations avancées ==');
  
  // Schéma avec prétraitement et post-traitement
  const DateSchema = s.string()
    .preprocess(value => {
      // Convertir les timestamps en chaînes de date
      if (typeof value === 'number') {
        return new Date(value).toISOString();
      }
      return value;
    })
    .refine(value => {
      // Valider le format de date
      const date = new Date(value as string);
      return !isNaN(date.getTime());
    }, "Invalid date string")
    .transform(value => new Date(value as string))
    .postprocess(date => ({
      date,
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      formatted: `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`,
    }));
  
  // Test avec une chaîne de date
  const result1 = DateSchema.safeParse('2023-05-15');
  if (result1.isOk()) {
    console.log('Transformation de chaîne ISO:', result1.unwrap());
  }
  
  // Test avec un timestamp
  const result2 = DateSchema.safeParse(1684152000000); // Timestamp pour 2023-05-15
  if (result2.isOk()) {
    console.log('Transformation de timestamp:', result2.unwrap());
  }
  
  // Test avec une valeur invalide
  const result3 = DateSchema.safeParse('not-a-date');
  if (result3.isErr()) {
    console.log('Erreur de validation date:', result3.unwrapErr().message);
  }
}

/**
 * Exemple 3: Validation asynchrone
 */
async function asyncValidationExample() {
  console.log('\n== Validation asynchrone ==');
  
  // Fonction simulant une vérification d'email dans une base de données
  async function checkEmailExistsInDatabase(email: string): Promise<boolean> {
    // Simuler un délai réseau
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Simuler une base de données d'emails existants
    const existingEmails = ['taken@example.com', 'used@example.com', 'registered@example.com'];
    return !existingEmails.includes(email);
  }
  
  // Schéma avec validation asynchrone
  const UserRegistrationSchema = s.object({
    username: s.string().min(3),
    email: s.string().email().asyncValidate(
      async (value) => {
        const isAvailable = await checkEmailExistsInDatabase(value);
        if (isAvailable) {
          return true;
        } else {
          return false;
        }
      },
      'Email is already registered'
    ),
    password: s.string().min(8),
  });

  try {
    // Validation avec email disponible
    const validUser = await UserRegistrationSchema.parseAsync({
      username: 'johndoe',
      email: 'available@example.com',
      password: 'securepass123',
    });
    console.log('Validation async réussie:', validUser);
    
    // Validation avec email déjà pris
    const invalidUser = await UserRegistrationSchema.parseAsync({
      username: 'janedoe',
      email: 'taken@example.com',
      password: 'securepass456',
    });
    console.log('Validation async avec email pris (ne devrait pas arriver ici):', invalidUser);
  } catch (error) {
    console.log('Erreur de validation async:', error.message);
  }
}

/**
 * Exemple 4: Gestion des versions et migrations
 */
function versioningExample() {
  console.log('\n== Gestion des versions et migrations ==');
  
  // Créer un registre de versions
  const userSchemaRegistry = s.createVersionRegistry();
  
  // Version 1 du schéma utilisateur
  const UserSchemaV1 = s.object({
    id: s.string().uuid(),
    name: s.string(),
    email: s.string().email(),
  }).meta('version', 'v1');
  
  // Version 2 du schéma utilisateur avec des champs supplémentaires
  const UserSchemaV2 = s.object({
    id: s.string().uuid(),
    name: s.string(),
    email: s.string().email(),
    age: s.number().int().optional(),
    createdAt: s.string().optional(),
  }).meta('version', 'v2');
  
  // Enregistrer les versions
  userSchemaRegistry.register({
    version: 'v1',
    schema: UserSchemaV1,
    createdAt: new Date('2023-01-01'),
  });
  
  userSchemaRegistry.register({
    version: 'v2',
    schema: UserSchemaV2,
    createdAt: new Date('2023-06-01'),
    newFields: ['age', 'createdAt'],
  });
  
  // Définir une migration de v1 à v2
  const migration = userSchemaRegistry.defineMigration(
    'v1',
    'v2',
    (userV1: Record<string, any>) => ({
      ...userV1,
      age: null, // Valeur par défaut pour les champs manquants
      createdAt: new Date().toISOString(),
    })
  );
  
  // Donnée utilisateur en v1
  const userDataV1 = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'John Doe',
    email: 'john@example.com',
  };
  
  // Migrer les données vers v2
  const migrationResult = userSchemaRegistry.migrate(userDataV1, 'v1', 'v2');
  
  if (migrationResult.isOk()) {
    console.log('Données migrées de v1 à v2:', migrationResult.unwrap());
    console.log('Nouveaux champs ajoutés dans v2:', migration.newFields);
  } else {
    console.error('Erreur pendant la migration:', migrationResult.unwrapErr().message);
  }
}

/**
 * Exemple 5: Métadonnées et documentation OpenAPI
 */
function metadataExample() {
  console.log('\n== Métadonnées et documentation ==');
  
  // Créer un schéma avec des métadonnées
  const ProductSchema = s.object({
    id: s.string().uuid().describe('Unique product identifier'),
    name: s.string().min(2).describe('Product name'),
    price: s.number().positive().describe('Product price in USD'),
    category: s.enum(['electronics', 'clothing', 'food', 'other']).describe('Product category'),
    tags: s.array(s.string()).describe('Product tags'),
    inStock: s.boolean().describe('Whether the product is in stock'),
  })
  .describe('Product information model')
  .example({
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Smartphone',
    price: 599.99,
    category: 'electronics',
    tags: ['tech', 'mobile'],
    inStock: true,
  })
  .meta('x-api-version', 'v1');
  
  // Récupérer les métadonnées
  const metadata = (ProductSchema as any).getMetadata();
  console.log('Métadonnées du schéma:', metadata);
  
  // Générer un schéma OpenAPI
  const openApiSchema = (ProductSchema as any).toOpenAPI();
  console.log('Schéma OpenAPI généré:', JSON.stringify(openApiSchema, null, 2));
}

// Exécuter les exemples
async function runExamples() {
  contextualValidationExample();
  transformationExample();
  await asyncValidationExample();
  versioningExample();
  metadataExample();
}

runExamples().catch(console.error);