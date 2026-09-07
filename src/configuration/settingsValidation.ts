import * as z from 'zod/mini';
import {
  type ConfigurationLayer,
  type ConfigurationProblem,
  type ConfigurationScopeName,
  type RawCategoryDefinition,
  type RawFilterDefinition,
} from './configurationLayer.js';

const stringListSchema = z.array(z.string());

const rawCategorySchema = z.strictObject({
  label: z.optional(z.string()),
  patterns: z.optional(stringListSchema),
});

const rawFilterSchema = z.strictObject({
  label: z.optional(z.string()),
  base: z.optional(z.enum(['showAll', 'hideAll'])),
  extends: z.optional(z.string()),
  enabled: z.optional(z.boolean()),
  hide: z.optional(stringListSchema),
  show: z.optional(stringListSchema),
});

const idPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** The raw values of one scope as VS Code hands them out. */
export interface RawScopeValues
{
  readonly categories: unknown;
  readonly filters: unknown;
  readonly leafFolders: unknown;
}

export interface LayerValidationResult
{
  readonly layer: ConfigurationLayer;
  readonly problems: readonly ConfigurationProblem[];
}

/**
 * Validates the Bonsai settings of one scope. Each category and filter is checked on its own,
 * so one invalid definition does not discard the others.
 */
export function validateConfigurationLayer(scope: ConfigurationScopeName, values: RawScopeValues): LayerValidationResult
{
  const problems: ConfigurationProblem[] = [];
  const categories = validateDefinitionMap<RawCategoryDefinition>(
    values.categories,
    rawCategorySchema,
    scope,
    'bonsai.categories',
    problems,
  );
  const filters = validateDefinitionMap<RawFilterDefinition>(values.filters, rawFilterSchema, scope, 'bonsai.filters', problems);
  const leafFolders = validateStringList(values.leafFolders, scope, 'bonsai.leafFolders', problems);
  return { layer: { scope, categories, filters, leafFolders }, problems };
}

function validateDefinitionMap<TDefinition>(
  value: unknown,
  schema: z.ZodMiniType<TDefinition>,
  scope: ConfigurationScopeName,
  path: string,
  problems: ConfigurationProblem[],
): Record<string, TDefinition>
{
  const definitions: Record<string, TDefinition> = {};
  if (value === undefined)
  {
    return definitions;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value))
  {
    problems.push({ scope, path, message: 'Expected an object keyed by id.' });
    return definitions;
  }
  for (const [id, rawDefinition] of Object.entries(value))
  {
    if (!idPattern.test(id))
    {
      problems.push({ scope, path: `${path}.${id}`, message: `"${id}" is not a valid id.` });
      continue;
    }
    const result = schema.safeParse(rawDefinition);
    if (!result.success)
    {
      for (const issue of result.error.issues)
      {
        problems.push({ scope, path: `${path}.${id}.${issue.path.join('.')}`, message: issue.message });
      }
      continue;
    }
    definitions[id] = result.data;
  }
  return definitions;
}

function validateStringList(
  value: unknown,
  scope: ConfigurationScopeName,
  path: string,
  problems: ConfigurationProblem[],
): readonly string[]
{
  if (value === undefined)
  {
    return [];
  }
  const result = stringListSchema.safeParse(value);
  if (!result.success)
  {
    problems.push({ scope, path, message: 'Expected a list of strings.' });
    return [];
  }
  return result.data;
}
