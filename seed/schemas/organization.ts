import { z } from 'zod';
import { Id, NonEmpty, seedFile } from './common';

/** Occupancy of a post. `VACANT` is stated by the prototype, never inferred. */
export const Occupancy = z.enum(['VACANT', 'TO_FILL', 'OCCUPIED']);

/** One of the three structures of the Direction de Production. */
export const Structure = z.object({
  id: Id,
  /** Decorative glyph the prototype prefixes to the name; kept out of the label itself. */
  icon: NonEmpty.nullable(),
  nameFr: NonEmpty,
  descriptionFr: NonEmpty,
  headOccupancy: Occupancy,
  headLabelFr: NonEmpty,
  criticalNoteFr: NonEmpty.nullable(),
});

/** A production unit attached to the Fabrication structure. */
export const ProductionUnit = z.object({
  id: Id,
  parentStructureId: Id,
  nameFr: NonEmpty,
  descriptionFr: NonEmpty,
});

/** A functional cell reporting to the Direction de Production. */
export const FunctionalCell = z.object({
  id: Id,
  icon: NonEmpty.nullable(),
  nameFr: NonEmpty,
  descriptionFr: NonEmpty,
  staffingFr: NonEmpty,
});

/** A node of the org chart rendered on the "structures" page. */
export const OrgChartNode = z.object({
  id: Id,
  labelFr: NonEmpty,
  roleFr: NonEmpty,
  occupancy: Occupancy.nullable(),
  parentId: Id.nullable(),
});

export const Organization = z.object({
  directorateFr: NonEmpty,
  summaryFr: NonEmpty,
  structures: z.array(Structure),
  units: z.array(ProductionUnit),
  cells: z.array(FunctionalCell),
  orgChart: z.array(OrgChartNode),
});

export const OrganizationFile = seedFile(Organization);
export type OrganizationT = z.infer<typeof Organization>;
