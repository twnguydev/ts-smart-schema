import { Schema } from './schema';
import { ValidationError } from './errors';
import { Result, ok, err } from './result';

/**
 * Information about a schema version
 */
export interface SchemaVersion<T> {
  /**
   * Schema version number
   */
  version: number | string;
  
  /**
   * Schema for this version
   */
  schema: Schema<T>;
  
  /**
   * List of deprecated fields in this version
   */
  deprecatedFields?: string[];
  
  /**
   * List of new fields in this version
   */
  newFields?: string[];
  
  /**
   * Date when this version was created
   */
  createdAt?: Date;
}

/**
 * Schema migration definition
 */
export interface MigrationPath<TFrom, TTo> {
  /**
   * Source schema version
   */
  from: SchemaVersion<TFrom>;
  
  /**
   * Target schema version
   */
  to: SchemaVersion<TTo>;
  
  /**
   * Migration function
   */
  migrate: (data: TFrom) => TTo;
}

/**
 * Schema migration utility
 */
export class Migration<TFrom, TTo> {
  constructor(
    private readonly migrationPath: MigrationPath<TFrom, TTo>
  ) {}
  
  /**
   * Migrate data from source schema to target schema
   */
  migrate(data: TFrom): Result<TTo, ValidationError> {
    // Validate against source schema
    const sourceResult = this.migrationPath.from.schema.safeParse(data);
    
    if (sourceResult.isErr()) {
      return err(new ValidationError([
        {
          path: [],
          message: `Source data does not conform to source schema: ${sourceResult.unwrapErr().message}`,
          code: 'migration.invalid_source',
        },
      ]));
    }
    
    // Apply migration
    try {
      const migratedData = this.migrationPath.migrate(data);
      
      // Validate migrated data against target schema
      const targetResult = this.migrationPath.to.schema.safeParse(migratedData);
      
      if (targetResult.isErr()) {
        return err(new ValidationError([
          {
            path: [],
            message: `Migration failed: migrated data does not conform to target schema: ${targetResult.unwrapErr().message}`,
            code: 'migration.invalid_target',
          },
        ]));
      }
      
      return ok(migratedData);
    } catch (error) {
      return err(new ValidationError([
        {
          path: [],
          message: `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
          code: 'migration.failed',
        },
      ]));
    }
  }
  
  /**
   * Get source schema version
   */
  get sourceVersion(): string | number {
    return this.migrationPath.from.version;
  }
  
  /**
   * Get target schema version
   */
  get targetVersion(): string | number {
    return this.migrationPath.to.version;
  }
  
  /**
   * Get deprecated fields
   */
  get deprecatedFields(): string[] {
    return this.migrationPath.from.deprecatedFields || [];
  }
  
  /**
   * Get new fields
   */
  get newFields(): string[] {
    return this.migrationPath.to.newFields || [];
  }
}

/**
 * A versioned schema with migration capabilities
 */
export class VersionedSchemaRegistry {
  private versions: Map<string | number, SchemaVersion<any>> = new Map();
  private migrations: Map<string, Migration<any, any>> = new Map();
  
  /**
   * Register a schema version
   */
  register<T>(version: SchemaVersion<T>): this {
    this.versions.set(version.version, version);
    return this;
  }
  
  /**
   * Define a migration between two schema versions
   */
  defineMigration<TFrom extends Record<string, any>, TTo extends Record<string, any>>(
    fromVersion: string | number,
    toVersion: string | number,
    migrateFn: (data: TFrom) => TTo
  ): Migration<TFrom, TTo> {
    // Get source schema version
    const fromSchema = this.versions.get(fromVersion);
    if (!fromSchema) {
      throw new Error(`Source schema version ${fromVersion} not registered`);
    }
    
    // Get target schema version
    const toSchema = this.versions.get(toVersion);
    if (!toSchema) {
      throw new Error(`Target schema version ${toVersion} not registered`);
    }
    
    // Create migration
    const migration = new Migration<TFrom, TTo>({
      from: fromSchema,
      to: toSchema,
      migrate: migrateFn,
    });
    
    // Register migration
    const migrationKey = `${fromVersion}=>${toVersion}`;
    this.migrations.set(migrationKey, migration);
    
    return migration;
  }
  
  /**
   * Get all registered versions
   */
  getVersions(): SchemaVersion<any>[] {
    return Array.from(this.versions.values());
  }
  
  /**
   * Get a specific version
   */
  getVersion(version: string | number): SchemaVersion<any> | undefined {
    return this.versions.get(version);
  }
  
  /**
   * Get a migration between two versions
   */
  getMigration<TFrom, TTo>(
    fromVersion: string | number,
    toVersion: string | number
  ): Migration<TFrom, TTo> | undefined {
    const migrationKey = `${fromVersion}=>${toVersion}`;
    return this.migrations.get(migrationKey) as Migration<TFrom, TTo> | undefined;
  }
  
  /**
   * Migrate data from one version to another
   */
  migrate<TFrom, TTo>(
    data: TFrom,
    fromVersion: string | number,
    toVersion: string | number
  ): Result<TTo, ValidationError> {
    // Get migration
    const migration = this.getMigration<TFrom, TTo>(fromVersion, toVersion);
    
    if (!migration) {
      return err(new ValidationError([
        {
          path: [],
          message: `No migration path defined from version ${fromVersion} to ${toVersion}`,
          code: 'migration.no_path',
        },
      ]));
    }
    
    // Apply migration
    return migration.migrate(data);
  }
}

/**
 * Create a new versioned schema registry
 */
export function createVersionRegistry(): VersionedSchemaRegistry {
  return new VersionedSchemaRegistry();
}