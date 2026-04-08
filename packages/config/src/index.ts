/**
 * Describes a single environment variable requirement.
 */
interface EnvVarSpec {
  /** Environment variable name. */
  readonly name: string;
  /** Whether the variable is required. Defaults to true. */
  readonly required?: boolean;
  /** Default value if not set. */
  readonly defaultValue?: string;
  /** Optional human-readable description. */
  readonly description?: string;
}

/**
 * Validation error for a missing or invalid environment variable.
 */
export interface ConfigValidationError {
  readonly variable: string;
  readonly message: string;
}

/**
 * Result of loading and validating configuration.
 */
export interface ConfigResult<T> {
  readonly success: boolean;
  readonly config: T | null;
  readonly errors: ReadonlyArray<ConfigValidationError>;
}

/**
 * Define a typed configuration schema and load values from process.env.
 *
 * @example
 * ```ts
 * const config = loadConfig({
 *   DATABASE_URL: { required: true, description: 'PostgreSQL connection string' },
 *   PORT: { required: false, defaultValue: '3000' },
 *   LOG_LEVEL: { required: false, defaultValue: 'info' },
 * });
 * ```
 */
export function loadConfig<TSchema extends Record<string, Omit<EnvVarSpec, 'name'>>>(
  schema: TSchema,
  env: Record<string, string | undefined> = process.env,
): ConfigResult<{ readonly [K in keyof TSchema]: string }> {
  const errors: ConfigValidationError[] = [];
  const config: Record<string, string> = {};

  for (const [key, spec] of Object.entries(schema)) {
    const value = env[key];
    const isRequired = spec.required !== false;

    if (value !== undefined && value !== '') {
      config[key] = value;
    } else if (spec.defaultValue !== undefined) {
      config[key] = spec.defaultValue;
    } else if (isRequired) {
      errors.push({
        variable: key,
        message: spec.description
          ? `Missing required env var ${key}: ${spec.description}`
          : `Missing required env var ${key}`,
      });
    }
  }

  if (errors.length > 0) {
    return { success: false, config: null, errors };
  }

  return {
    success: true,
    config: config as { readonly [K in keyof TSchema]: string },
    errors: [],
  };
}

/**
 * Load config and throw if validation fails.
 * Use at application startup for fail-fast behavior.
 */
export function requireConfig<TSchema extends Record<string, Omit<EnvVarSpec, 'name'>>>(
  schema: TSchema,
  env: Record<string, string | undefined> = process.env,
): { readonly [K in keyof TSchema]: string } {
  const result = loadConfig(schema, env);

  if (!result.success || result.config === null) {
    const errorMessages = result.errors.map((e) => `  - ${e.message}`).join('\n');
    throw new Error(`Configuration validation failed:\n${errorMessages}`);
  }

  return result.config;
}

/**
 * Parse a numeric environment variable with bounds checking.
 */
export function parseIntEnv(value: string, min?: number, max?: number): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Expected integer, got "${value}"`);
  }
  if (min !== undefined && parsed < min) {
    throw new Error(`Value ${parsed} is below minimum ${min}`);
  }
  if (max !== undefined && parsed > max) {
    throw new Error(`Value ${parsed} exceeds maximum ${max}`);
  }
  return parsed;
}

/**
 * Parse a boolean environment variable.
 * Accepts: "true", "1", "yes" as true; "false", "0", "no" as false.
 */
export function parseBoolEnv(value: string): boolean {
  const lower = value.toLowerCase().trim();
  if (['true', '1', 'yes'].includes(lower)) return true;
  if (['false', '0', 'no'].includes(lower)) return false;
  throw new Error(`Expected boolean, got "${value}"`);
}
