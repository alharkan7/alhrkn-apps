/**
 * Freeform diagram layout presets for Inztagram.
 * Used by the landing UI picker and injected into the generation prompt.
 */

export interface FreeformLayout {
  /** Stable id sent to the API */
  id: string;
  /** Short label in the picker */
  label: string;
  /** One-line hint under the label (optional) */
  description: string;
  /** Extra prompt block for the model */
  instructions: string;
  /** Preview image path under /public */
  image: string;
}

/** Layouts shown in freeform mode (excluding Auto, which is null selection). */
export const FREEFORM_LAYOUTS: FreeformLayout[] = [
  {
    id: 'flow',
    label: 'Flow',
    description: 'Steps and process',
    image: '/inztagram/layouts/flow.svg',
    instructions: `Layout: FLOW (process / flowchart).
- Arrange steps as a clear path: top-to-bottom or left-to-right.
- Use rounded cards for each step; number them when order matters.
- Connect with curved arrows showing direction and decision branches if needed.
- Group phases with subtle section frames when there are many steps.`,
  },
  {
    id: 'timeline',
    label: 'Timeline',
    description: 'Events over time',
    image: '/inztagram/layouts/timeline.svg',
    instructions: `Layout: TIMELINE.
- Draw a clear horizontal or vertical axis with time markers.
- Place event cards along the axis with short titles and optional dates/captions.
- Keep chronological order; use dashed drop-lines from axis to cards when helpful.
- Prefer a wide or tall viewBox so events do not stack on top of each other.`,
  },
  {
    id: 'grid',
    label: 'Grid',
    description: 'Cards in rows/columns',
    image: '/inztagram/layouts/grid.svg',
    instructions: `Layout: GRID (matrix of cards).
- Arrange content in a regular 2xN or 3xN card grid with even spacing.
- Each cell is a self-contained card (title + short body or icon).
- Align columns mathematically; equal card widths within a row.
- Good for features, pillars, options, or parallel concepts without a strong sequence.`,
  },
  {
    id: 'hierarchy',
    label: 'Hierarchy',
    description: 'Tree / org chart',
    image: '/inztagram/layouts/hierarchy.svg',
    instructions: `Layout: HIERARCHY (tree / org chart).
- Root or top node at the top (or left); children branch below (or right).
- Keep levels aligned; connect parents to children with clean curves or soft elbows.
- Wider viewBox for bushy trees; balance branches so the canvas does not feel lopsided.
- Label each node clearly; avoid crossing connectors when possible.`,
  },
  {
    id: 'radial',
    label: 'Radial',
    description: 'Hub and spokes',
    image: '/inztagram/layouts/radial.svg',
    instructions: `Layout: RADIAL (hub-and-spoke).
- Place the core concept in the center as a distinct hub card or circle.
- Arrange related entities around the hub at roughly equal angles.
- Connect spokes with curved or straight lines from hub to satellites.
- Optional outer ring for secondary details; keep the center readable.`,
  },
  {
    id: 'layers',
    label: 'Layers',
    description: 'Stacked architecture',
    image: '/inztagram/layouts/layers.svg',
    instructions: `Layout: LAYERS (stacked architecture / stack).
- Stack horizontal bands or large rounded slabs from top to bottom (or left to right for depth).
- Order layers by abstraction (e.g. clients → edge → services → data).
- Place components inside their layer; use soft connectors only when cross-layer flow matters.
- Distinct pastel tint per layer; clear layer titles on the left or top of each band.`,
  },
  {
    id: 'swimlane',
    label: 'Swimlane',
    description: 'Actors in rows',
    image: '/inztagram/layouts/swimlane.svg',
    instructions: `Layout: SWIMLANE.
- One horizontal (or vertical) lane per actor, team, or system.
- Place process steps inside the lane that owns them; sequence left-to-right (or top-to-bottom).
- Cross-lane handoffs with arrows that cross lane boundaries cleanly.
- Label each lane; light background strips to separate lanes.`,
  },
  {
    id: 'cycle',
    label: 'Cycle',
    description: 'Looping process',
    image: '/inztagram/layouts/cycle.svg',
    instructions: `Layout: CYCLE (loop / flywheel).
- Arrange 3–8 stages in a closed loop (circle or rounded polygon path).
- Arrows should clearly show continuous flow back to the start.
- Optional center label for the overall cycle name.
- Keep stage cards outside or on the ring so text stays legible.`,
  },
  {
    id: 'mindmap',
    label: 'Mind map',
    description: 'Branches from center',
    image: '/inztagram/layouts/mindmap.svg',
    instructions: `Layout: MIND MAP.
- Central topic node; primary branches radiate outward; secondary topics on each branch.
- Use organic curved branches rather than a rigid grid.
- Color-code major branches; keep labels short on the branches.
- Not the same as a strict org hierarchy—emphasize ideation and related ideas.`,
  },
  {
    id: 'sequence',
    label: 'Sequence',
    description: 'Interactions over time',
    image: '/inztagram/layouts/sequence.svg',
    instructions: `Layout: SEQUENCE (interaction over time).
- Participants as columns (headers at top); time flows downward.
- Messages as horizontal arrows between columns with short labels.
- Optional activation boxes or notes for important steps.
- Similar spirit to UML sequence, but freeform soft-styled SVG (not Mermaid syntax).`,
  },
  {
    id: 'comparison',
    label: 'Comparison',
    description: 'Side-by-side options',
    image: '/inztagram/layouts/comparison.svg',
    instructions: `Layout: COMPARISON.
- Two or three equal columns (or large cards) for options/alternatives.
- Shared criteria as rows or bullet groups so differences are scannable.
- Optional highlight/recommendation zone for the preferred option.
- Balanced column widths; clear column headers.`,
  },
  {
    id: 'funnel',
    label: 'Funnel',
    description: 'Stages that narrow',
    image: '/inztagram/layouts/funnel.svg',
    instructions: `Layout: FUNNEL.
- Stages stacked vertically, widest at top and narrower toward the bottom (or left-to-right taper).
- Each stage is a labeled band with optional metrics or short notes.
- Emphasize conversion / filtering from stage to stage.
- Soft pastel fills; keep the taper readable with enough height per stage.`,
  },
];

export function getFreeformLayout(id: string | undefined | null): FreeformLayout | undefined {
  if (!id) return undefined;
  return FREEFORM_LAYOUTS.find((l) => l.id === id);
}
