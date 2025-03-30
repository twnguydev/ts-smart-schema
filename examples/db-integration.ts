import { s, createSchemaFromModel, createModelFromSchema, SQLSchemaAdapter } from '../src';

/**
 * Exemple d'intégration avec une base de données
 */
async function databaseIntegrationExample() {
  console.log('== Intégration avec base de données ==');
  
  // 1. Définir un modèle de base de données manuellement
  const userModel = {
    name: 'users',
    fields: [
      {
        name: 'id',
        type: 'string',
        required: true,
        unique: true,
        description: 'Identifiant unique de l\'utilisateur',
      },
      {
        name: 'name',
        type: 'string',
        required: true,
        constraints: {
          min: 2,
          max: 50,
        },
        description: 'Nom complet de l\'utilisateur',
      },
      {
        name: 'email',
        type: 'string',
        required: true,
        unique: true,
        constraints: {
          email: true,
        },
        description: 'Adresse email de l\'utilisateur',
      },
      {
        name: 'age',
        type: 'integer',
        required: false,
        constraints: {
          min: 18,
          max: 120,
        },
        description: 'Âge de l\'utilisateur',
      },
      {
        name: 'created_at',
        type: 'timestamp',
        required: true,
        description: 'Date de création du compte',
      },
    ],
    description: 'Table des utilisateurs du système',
  };
  
  // 2. Créer un schéma à partir du modèle
  const UserSchema = createSchemaFromModel(userModel);
  
  console.log('\nSchéma créé à partir du modèle de base de données:');
  
  // 3. Utiliser le schéma pour valider des données
  const userData = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    created_at: '2023-01-15T12:00:00Z',
  };
  
  try {
    const validatedUser = UserSchema.parse(userData);
    console.log('Données validées avec succès:', validatedUser);
  } catch (error) {
    console.error('Erreur de validation:', error.message);
  }
  
  // 4. Créer un modèle à partir d'un schéma existant
  const ProductSchema = s.object({
    id: s.string().uuid().describe('Identifiant unique du produit'),
    name: s.string().min(3).max(100).describe('Nom du produit'),
    price: s.number().positive().describe('Prix unitaire'),
    category: s.string().optional().describe('Catégorie du produit'),
    in_stock: s.boolean().describe('Disponibilité en stock'),
    created_at: s.string().describe('Date de création'),
  });
  
  const productModel = createModelFromSchema('products', ProductSchema, {
    description: 'Catalogue de produits',
  });
  
  console.log('\nModèle créé à partir du schéma:');
  console.log(`Table: ${productModel.name}`);
  console.log(`Description: ${productModel.description}`);
  console.log(`Nombre de champs: ${productModel.fields.length}`);
  
  // 5. Exemple d'adaptateur SQL (implémentation partielle)
  class SQLiteAdapter extends SQLSchemaAdapter {
    protected getConnection() {
      // Simulation
      return null;
    }
    
    protected mapSqlType(sqlType: string): string {
      // Mapper les types SQLite aux types de la bibliothèque
      switch (sqlType.toUpperCase()) {
        case 'INTEGER':
        case 'INT':
          return 'integer';
        case 'TEXT':
          return 'string';
        case 'REAL':
        case 'FLOAT':
          return 'number';
        case 'BLOB':
          return 'object';
        default:
          return 'any';
      }
    }
    
    protected getColumnsQuery(tableName: string): string {
      return `PRAGMA table_info(${tableName})`;
    }
    
    protected getTablesQuery(): string {
      return "SELECT name as table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
    }
    
    protected async executeQuery<T>(query: string): Promise<T[]> {
      // Simuler une requête SQLite
      console.log(`Exécution de la requête: ${query}`);
      
      // Retourner des données simulées
      if (query.includes('sqlite_master')) {
        return [
          { table_name: 'users' },
          { table_name: 'products' },
          { table_name: 'orders' },
        ] as unknown as T[];
      }
      
      if (query.includes('table_info(users)')) {
        return [
          { name: 'id', type: 'TEXT', notnull: 1, pk: 1 },
          { name: 'name', type: 'TEXT', notnull: 1 },
          { name: 'email', type: 'TEXT', notnull: 1 },
          { name: 'age', type: 'INTEGER', notnull: 0 },
          { name: 'created_at', type: 'TEXT', notnull: 1 },
        ] as unknown as T[];
      }
      
      return [] as unknown as T[];
    }
    
    protected columnToField(column: any): any {
      return {
        name: column.name,
        type: this.mapSqlType(column.type),
        required: column.notnull === 1,
        unique: column.pk === 1,
      };
    }
  }
  
  // 6. Utiliser l'adaptateur SQL pour générer des schémas
  const sqliteAdapter = new SQLiteAdapter();
  
  console.log('\nGénération de schémas à partir de la base de données:');
  
  // Obtenir la liste des tables
  const tables = await sqliteAdapter.getTables();
  console.log('Tables trouvées:', tables);
  
  // Générer un schéma pour la table users
  const dbUserSchema = await sqliteAdapter.generateTableSchema('users');
  
  console.log('Schéma généré pour la table users');
  
  // 7. Simuler un ORM avec validation automatique
  class TypedORM {
    private schemas: Record<string, any> = {};
    
    registerSchema(name: string, schema: any) {
      this.schemas[name] = schema;
      console.log(`Schéma '${name}' enregistré`);
    }
    
    async find(model: string, query: any): Promise<any[]> {
      console.log(`Recherche dans '${model}' avec:`, query);
      
      // Simuler une requête
      const results = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'John Doe',
          email: 'john@example.com',
          age: 30,
          created_at: '2023-01-15T12:00:00Z',
        }
      ];
      
      // Valider les résultats
      if (this.schemas[model]) {
        return results.map(item => this.schemas[model].parse(item));
      }
      
      return results;
    }
    
    async create(model: string, data: any): Promise<any> {
      console.log(`Création dans '${model}':`, data);
      
      // Valider les données
      if (this.schemas[model]) {
        const validatedData = this.schemas[model].parse(data);
        
        // Simuler l'insertion
        console.log('Données validées, insertion simulée');
        
        return {
          ...validatedData,
          id: '123e4567-e89b-12d3-a456-426614174001',
          created_at: new Date().toISOString(),
        };
      }
      
      throw new Error(`Schéma non trouvé pour '${model}'`);
    }
  }
  
  // 8. Utiliser l'ORM avec validation automatique
  console.log('\nUtilisation avec un ORM typé:');
  
  const orm = new TypedORM();
  
  // Enregistrer le schéma
  orm.registerSchema('users', UserSchema);
  
  // Rechercher des utilisateurs
  const users = await orm.find('users', { name: 'John' });
  console.log('Utilisateurs trouvés:', users.length);
  
  // Créer un nouvel utilisateur
  try {
    const newUser = await orm.create('users', {
      name: 'Jane Doe',
      email: 'jane@example.com',
      age: 28,
    });
    
    console.log('Nouvel utilisateur créé:', newUser.id);
  } catch (error) {
    console.error('Erreur lors de la création:', error.message);
  }
}

// Exécuter l'exemple
databaseIntegrationExample().catch(console.error);