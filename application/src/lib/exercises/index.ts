/**
 * Open exercise system — public surface.
 *
 * Import from '@/lib/exercises' rather than reaching into submodules, so the
 * internal file layout stays free to move.
 *
 * Note: `type-repo` and `grading` touch the DB and are deliberately NOT
 * re-exported here — importing them pulls in `@/lib/db/client`, which would
 * make this barrel unusable from a Client Component. Import those two by path.
 */
export type {
  GradeResult,
  GradeStatus,
  GradeContext,
  Grader,
  GradingMode,
} from './types';
export { clamp01, statusForScore, binary } from './types';
export {
  gradeAnswer,
  getGrader,
  hasGrader,
  listGraderEngines,
  registerGrader,
  gradingModeFor,
  UnknownEngineError,
} from './registry';
export { sanitizePayload, containsAny } from './sanitize';
export {
  buildTypeResolver,
  resolveExerciseType,
  type ResolvedExerciseType,
  type ExerciseTypeRowLike,
} from './resolve';
export {
  BUILTIN_EXERCISE_TYPES,
  LEGACY_EXERCISE_KINDS,
  getBuiltinExerciseType,
  isBuiltinExerciseKind,
  type BuiltinExerciseType,
} from './builtin-types';
export {
  FIELD_TYPES,
  fieldSpecSchema,
  fieldDescriptorSchema,
  buildZodFromSpec,
  secretFieldsOf,
  parseFieldSpec,
  type FieldSpec,
  type FieldDescriptor,
  type FieldType,
} from './field-spec';
export { matchOne, normalizeLoose, type MatchKind } from './match';
export { weightedRubricScore, type RubricCriterion } from './graders/manual';
