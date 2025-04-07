import { Schema, ValidationOptions, PartialSchema } from '../core/schema';
import { Result, ok, err } from '../core/result';
import { ValidationError, ValidationIssue } from '../core/errors';

/**
 * Type helper to extract schema types from a shape object
 */
export type InferObjectType<S extends Record<string, Schema<any>>> = {
  [K in keyof S]: S[K] extends Schema<infer T> ? T : never;
};

/**
 * Schema for object validation
 */
export class ObjectSchema<T extends Record<string, any>> extends Schema<T> {
  private readonly _shape: Record<string, Schema<any>>;
  private readonly _required: Set<string>;
  private readonly _defaults: Record<string, any>;

  constructor(options: ObjectSchemaOptions<T>) {
    super();
    this._shape = options.shape || {};
    this._required = new Set(options.required || Object.keys(this._shape));
    this._defaults = options.defaults || {} as Partial<T>;
  }

  /**
   * Make specific properties required
   */
  required<K extends keyof T>(keys: K | K[]): ObjectSchema<T> {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    const required = new Set(this._required);

    for (const key of keysArray) {
      required.add(key as string);
    }

    return new ObjectSchema<T>({
      shape: this._shape,
      required: Array.from(required),
      defaults: this._defaults,
    });
  }

  /**
   * Set default values for properties
   */
  default<K extends keyof T>(key: K, value: T[K]): ObjectSchema<T> {
    // Obtenir la liste actuelle des propriétés requises
    const required = new Set(this._required);

    // Rendre la propriété optionnelle en la supprimant de l'ensemble des propriétés requises
    required.delete(key as string);

    return new ObjectSchema<T>({
      shape: this._shape,
      required: Array.from(required),
      defaults: {
        ...this._defaults,
        [key]: value,
      },
    });
  }

  /**
   * Generate a partial schema where all properties are optional
   */
  partial(): PartialSchema<T> {
    // Transforme chaque propriété du schéma en version partielle
    const partialShape: Record<string, Schema<any>> = {};

    for (const [key, schema] of Object.entries(this._shape)) {
      partialShape[key] = schema.partial();
    }

    // Sauvegardons les defaults ici pour y accéder dans les fonctions internes
    const defaults = this._defaults;

    // Créer un schéma partiel de base
    const partialSchema = new ObjectSchema<Partial<T>>({
      shape: partialShape,
      required: [], // Aucune propriété requise
      defaults: defaults,
    });

    // Ajout de la méthode required au schéma partiel
    return Object.assign(partialSchema, {
      required<K extends keyof T>(keys: K | K[]): PartialSchema<T> {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        const required = new Set<string>();

        for (const key of keysArray) {
          required.add(key as string);
        }

        const newSchema = new ObjectSchema<Partial<T>>({
          shape: partialShape,
          required: Array.from(required),
          defaults: defaults,
        });

        // Ajouter à nouveau la méthode required
        return Object.assign(newSchema, {
          required<K extends keyof T>(moreKeys: K | K[]): PartialSchema<T> {
            const moreKeysArray = Array.isArray(moreKeys) ? moreKeys : [moreKeys];
            const combinedRequired = new Set<string>(required);

            for (const key of moreKeysArray) {
              combinedRequired.add(key as string);
            }

            return new ObjectSchema<Partial<T>>({
              shape: partialShape,
              required: Array.from(combinedRequired),
              defaults: defaults,
            }) as PartialSchema<T>;
          }
        }) as PartialSchema<T>;
      }
    }) as PartialSchema<T>;
  }

  /**
   * Make the entire object or specific properties optional
   * @param keys - If provided, makes only these properties optional
   * @returns A new schema with optional properties or an optional object
   */
  optional<K extends keyof T>(keys?: K | K[]): Schema<T | undefined> | ObjectSchema<T> {
    if (keys === undefined) {
      return new OptionalObjectSchema<T>(this);
    }

    const keysArray: K[] = Array.isArray(keys) ? keys : [keys];
    const required = new Set(this._required);

    for (const key of keysArray) {
      required.delete(key as string);
    }

    return new ObjectSchema<T>({
      shape: this._shape,
      required: Array.from(required),
      defaults: this._defaults,
    });
  }

  /**
   * Parse and validate object data
   */
  _parse(data: unknown, options: ValidationOptions): Result<T, ValidationError> {
    const path = options.path || [];

    // Type check
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return err(ValidationError.typeMismatch('object', data, path));
    }

    const value = data as Record<string, unknown>;
    const result: Record<string, any> = {};
    const issues: ValidationIssue[] = [];

    // Apply defaults if enabled in options
    const useDefaults = options.defaults !== false;

    // Validate each property in the shape
    for (const [key, schema] of Object.entries(this._shape)) {
      const propPath = [...path, key];

      if (key in value) {
        // Validate existing property
        const propResult = schema.safeParse(value[key], {
          ...options,
          path: propPath,
        });

        if (propResult.isOk()) {
          result[key] = propResult.unwrap();
        } else {
          issues.push(...propResult.unwrapErr().issues);

          // Abort early if requested
          if (options.abortEarly && issues.length > 0) {
            return err(this.validationError(issues));
          }
        }
      } else if (this._required.has(key)) {
        // Si la propriété est requise mais absente
        if (useDefaults && key in this._defaults) {
          // Appliquer la valeur par défaut explicite
          result[key] = this._defaults[key];
        } else {
          // Essayer d'obtenir une valeur par défaut du schéma
          let hasDefault = false;

          if (useDefaults) {
            try {
              // Tenter d'obtenir une valeur par défaut en validant undefined
              const defaultResult = schema.safeParse(undefined, {
                ...options,
                path: propPath,
                defaults: true
              });

              if (defaultResult.isOk()) {
                const defaultValue = defaultResult.unwrap();
                if (defaultValue !== undefined) {
                  result[key] = defaultValue;
                  hasDefault = true;
                }
              }
            } catch (e) {
              // Ignorer les erreurs lors de la tentative d'obtention d'une valeur par défaut
            }
          }

          // Si nous n'avons pas pu obtenir de valeur par défaut, signaler l'erreur
          if (!hasDefault) {
            issues.push(this.issue(
              `Required property missing`,
              'object.required',
              propPath
            ));

            // Abort early if requested
            if (options.abortEarly && issues.length > 0) {
              return err(this.validationError(issues));
            }
          }
        }
      } else if (useDefaults) {
        // Propriété optionnelle absente
        if (key in this._defaults) {
          // Appliquer la valeur par défaut explicite de l'objet
          result[key] = this._defaults[key];
        } else {
          // Pour tous les schémas (pas seulement récursifs), essayer d'obtenir une valeur par défaut
          try {
            // Tenter d'obtenir une valeur par défaut du schéma
            const defaultResult = schema.safeParse(undefined, {
              ...options,
              path: propPath,
              defaults: true
            });

            if (defaultResult.isOk()) {
              const defaultValue = defaultResult.unwrap();
              if (defaultValue !== undefined) {
                result[key] = defaultValue;
              }
            }
          } catch (e) {
            // Ignorer les erreurs lors de la tentative de création de valeur par défaut
          }
        }
      }
    }

    // Check for unknown properties if not stripping them
    if (!options.stripUnknown) {
      for (const key of Object.keys(value)) {
        if (!(key in this._shape)) {
          result[key] = value[key];
        }
      }
    } else {
      // Only include known properties when stripUnknown is true
      for (const key of Object.keys(value)) {
        if (key in this._shape && !(key in result)) {
          result[key] = value[key];
        }
      }
    }

    if (issues.length > 0) {
      return err(this.validationError(issues));
    }

    return ok(result as T);
  }
}

/**
 * Schema for optional objects
 */
class OptionalObjectSchema<T extends Record<string, any>> extends Schema<T | undefined> {
  constructor(private readonly baseSchema: ObjectSchema<T>) {
    super();
  }
  
  /**
   * Parse and validate object data
   */
  _parse(data: unknown, options: ValidationOptions): Result<T | undefined, ValidationError> {
    if (data === undefined || data === null) {
      return ok(undefined);
    }
    
    return this.baseSchema._parse(data, options);
  }
  
  /**
   * Generate a partial schema
   */
  partial(): Schema<Partial<T> | undefined> {
    // Return a partial schema that can also be undefined
    return new OptionalObjectSchema(this.baseSchema.partial() as ObjectSchema<Partial<T>>);
  }
}

/**
 * Options for object schema
 */
export interface ObjectSchemaOptions<T extends Record<string, any>> {
  shape?: Record<string, Schema<any>>;
  required?: string[];
  defaults?: Partial<T> | Record<string, any>;
}

/**
 * Create an object schema
 */
export function object<S extends Record<string, Schema<any>>>(
  shape: S
): ObjectSchema<InferObjectType<S>> {
  return new ObjectSchema({
    shape,
    required: Object.keys(shape),
  });
}