import { s } from '../src';

// Définir un schéma utilisateur
const UserSchema = s.object({
  id: s.string().uuid(),
  name: s.string().min(2).max(50),
  email: s.string().email(),
  age: s.number().int().positive().optional(),
  roles: s.array(s.string()),
  metadata: s.object({
    createdAt: s.string(), // Idéalement ce serait un type Date
    lastLogin: s.string().optional(),
  }).optional(),
});

// Type inféré à partir du schéma
type User = typeof s.InferType<typeof UserSchema>;

// Fonction pour montrer l'utilisation
function main() {
  console.log('== Validation de base ==');
  
  // Données valides
  const validData = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    roles: ['user', 'admin'],
    metadata: {
      createdAt: '2023-10-01T12:00:00Z',
      lastLogin: '2023-10-02T12:00:00Z',
    },
  };
  
  try {
    // Parse réussit avec des données valides
    const user = UserSchema.parse(validData);
    console.log('Données valides:', user);
  } catch (error) {
    console.error('Erreur inattendue:', error);
  }
  
  // Données invalides
  const invalidData = {
    id: 'invalid-uuid',
    name: 'J', // Trop court
    email: 'invalid-email',
    age: -5, // Négatif
    roles: ['user', 123], // 123 n'est pas un string
  };
  
  // Utilisation de safeParse pour éviter les exceptions
  const result = UserSchema.safeParse(invalidData);
  
  if (result.isOk()) {
    console.log('Données valides (inattendu):', result.unwrap());
  } else {
    console.log('Erreurs de validation:');
    console.log(result.unwrapErr().issues);
  }
  
  console.log('\n== Utilisation de schéma partiel ==');
  
  // Créer un schéma partiel pour les mises à jour
  const UserUpdateSchema = UserSchema.partial().required('id');
  
  // Mise à jour valide (seul l'id est obligatoire)
  const validUpdate = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'John Smith',
  };
  
  try {
    const updatedUser = UserUpdateSchema.parse(validUpdate);
    console.log('Mise à jour valide:', updatedUser);
  } catch (error) {
    console.error('Erreur inattendue:', error);
  }
  
  console.log('\n== Utilisation de biMap ==');
  
  // Schéma API avec des noms de champs différents
  const ApiUserSchema = s.object({
    user_id: s.string(),
    user_name: s.string(),
    user_email: s.string(),
  });
  
  // Créer un mapping bidirectionnel
  const mapping = s.biMap(UserSchema, ApiUserSchema, {
    to: {
      user_id: (user) => user.id,
      user_name: (user) => user.name,
      user_email: (user) => user.email,
    },
    from: {
      id: (apiUser) => apiUser.user_id,
      name: (apiUser) => apiUser.user_name,
      email: (apiUser) => apiUser.user_email,
      age: () => undefined, // Champ manquant dans l'API
      roles: () => [], // Valeur par défaut
      metadata: () => undefined, // Champ manquant dans l'API
    },
  });
  
  // Convertir de User vers ApiUser
  const apiResult = mapping.to(validData);
  if (apiResult.isOk()) {
    console.log('Converti en format API:', apiResult.unwrap());
  }
  
  // Convertir de ApiUser vers User
  const apiData = {
    user_id: '123e4567-e89b-12d3-a456-426614174000',
    user_name: 'John Doe',
    user_email: 'john@example.com',
  };
  
  const userResult = mapping.from(apiData);
  if (userResult.isOk()) {
    console.log('Converti depuis format API:', userResult.unwrap());
  }
  
  console.log('\n== Utilisation de versioned ==');
  
  // Créer une instance versionnée
  const versioned = UserSchema.createVersioned({
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'John Original',
    email: 'john@example.com',
    age: 30,
    roles: ['user'],
    metadata: {
      createdAt: '2023-10-01T12:00:00Z',
      lastLogin: '2023-10-02T12:00:00Z',
    },
  });
  
  // Appliquer des transformations
  versioned.transform((data) => {
    data.name = 'John Modified';
    data.roles.push('editor');
  }, 'Modification du nom et rôles');
  
  console.log('État actuel:', versioned.current);
  
  // Appliquer une autre transformation
  versioned.transform((data) => {
    data.age = 31;
    data.email = 'john.updated@example.com';
  }, 'Mise à jour âge et email');
  
  console.log('Nouvel état:', versioned.current);
  
  // Revenir en arrière
  versioned.revert();
  console.log('Après revert:', versioned.current);
  
  // Afficher l'historique
  console.log('Historique des versions:');
  console.log(versioned.history.map(v => ({
    label: v.label,
    timestamp: new Date(v.timestamp).toISOString(),
    isCurrent: v.isCurrent,
  })));
}

// Exécuter la démonstration
main();