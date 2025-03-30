import { Schema } from './schema';
import { deepClone } from '../utils/clone';

/**
 * Version entry in history
 */
interface VersionEntry<T> {
  data: T;
  timestamp: number;
  label?: string;
}

/**
 * Options for versioned instance
 */
export interface VersionedOptions {
  /**
   * Maximum number of versions to keep in history
   */
  maxVersions?: number;
  
  /**
   * Whether to automatically add new versions on transform
   */
  autoVersion?: boolean;
  
  /**
   * Custom cloning function (defaults to deep clone)
   */
  clone?: <T>(data: T) => T;
}

/**
 * Default versioned options
 */
const DEFAULT_VERSIONED_OPTIONS: Required<VersionedOptions> = {
  maxVersions: 10,
  autoVersion: true,
  clone: deepClone,
};

/**
 * A versioned wrapper around schema-validated data
 * with transformation and history tracking
 */
export class Versioned<T> {
  private readonly _schema: Schema<T>;
  private readonly _history: VersionEntry<T>[] = [];
  private readonly _options: Required<VersionedOptions>;
  private _currentIndex: number = 0;
  
  /**
   * Create a new versioned instance
   */
  constructor(schema: Schema<T>, initialData: T, options: VersionedOptions = {}) {
    this._schema = schema;
    this._options = { ...DEFAULT_VERSIONED_OPTIONS, ...options } as Required<VersionedOptions>;

    this._addVersion(initialData);
  }
  
  /**
   * Get the current data
   */
  get current(): T {
    return this._history[this._currentIndex].data;
  }
  
  /**
   * Get all versions in history
   */
  get history(): ReadonlyArray<{
    data: T;
    timestamp: number;
    label?: string;
    isCurrent: boolean;
  }> {
    return this._history.map((entry, index) => ({
      ...entry,
      isCurrent: index === this._currentIndex,
    }));
  }
  
  /**
   * Get the current schema
   */
  get schema(): Schema<T> {
    return this._schema;
  }
  
  /**
   * Apply a transformation to the current data
   */
  transform(transformer: (data: T) => void, label?: string): T {
    // Clone current data
    const clonedData = this._options.clone(this.current);
    
    // Apply transformer to cloned data
    transformer(clonedData);
    
    // Validate transformed data
    const result = this._schema.safeParse(clonedData);
    
    if (result.isErr()) {
      throw result.unwrapErr();
    }
    
    // Get the validated data
    const validatedData = result.unwrap();
    
    // Add new version if auto-versioning is enabled
    if (this._options.autoVersion) {
      this._addVersion(validatedData, label);
    } else {
      // Just update the current version
      this._history[this._currentIndex].data = validatedData;
    }
    
    return validatedData;
  }
  
  /**
   * Create a new version with the given data
   */
  createVersion(data: T, label?: string): T {
    const result = this._schema.safeParse(data);
    
    if (result.isErr()) {
      throw result.unwrapErr();
    }
    
    // Get the validated data
    const validatedData = result.unwrap();
    
    // Add new version
    this._addVersion(validatedData, label);
    
    return validatedData;
  }
  
  /**
   * Revert to a previous version
   */
  revert(steps: number = 1): T {
    if (steps <= 0) {
      throw new Error('Steps must be positive');
    }
    
    const targetIndex = this._currentIndex - steps;
    
    if (targetIndex < 0) {
      throw new Error(`Cannot revert ${steps} steps, only ${this._currentIndex} versions are available`);
    }
    
    this._currentIndex = targetIndex;
    return this.current;
  }
  
  /**
   * Redo a previously undone transformation
   */
  redo(steps: number = 1): T {
    if (steps <= 0) {
      throw new Error('Steps must be positive');
    }
    
    const targetIndex = this._currentIndex + steps;
    
    if (targetIndex >= this._history.length) {
      throw new Error(`Cannot redo ${steps} steps, only ${this._history.length - this._currentIndex - 1} versions are available`);
    }
    
    this._currentIndex = targetIndex;
    return this.current;
  }
  
  /**
   * Add a version to the history
   */
  private _addVersion(data: T, label?: string): void {
    // Remove any versions after the current index (if we've gone back in history)
    if (this._currentIndex < this._history.length - 1) {
      this._history.splice(this._currentIndex + 1);
    }
    
    // Add new version
    this._history.push({
      data: this._options.clone(data),
      timestamp: Date.now(),
      label,
    });
    
    // Update current index
    this._currentIndex = this._history.length - 1;
    
    // Trim history if needed
    this._trimHistory();
  }
  
  /**
   * Trim history to max versions
   */
  private _trimHistory(): void {
    const maxVersions = this._options.maxVersions;
    
    if (this._history.length > maxVersions) {
      // Keep the most recent versions
      const excess = this._history.length - maxVersions;
      this._history.splice(0, excess);
      this._currentIndex = Math.max(0, this._currentIndex - excess);
    }
  }
}

/**
 * Extension to Schema for versioned data
 */
export function addVersionedToSchema(): void {
  // Ajouter la méthode createVersioned au prototype de Schema
  Schema.prototype.createVersioned = function<T>(data: T, options?: VersionedOptions): Versioned<T> {
    // Valider les données initiales
    const result = this.safeParse(data);
    
    if (result.isErr()) {
      throw result.unwrapErr();
    }
    
    // Créer une instance versionnée avec les données validées
    return new Versioned(this, result.unwrap(), options);
  };
}