// Names for cross-document view transitions (see src/styles/motion.css).

/**
 * The `view-transition-name` of a project's photograph. The card's cover, the home page hero and
 * the project page's cover share it, so the photograph moves between them. A name must be a
 * valid CSS identifier and unique on the page, so anything but lowercase letters, digits and
 * hyphens becomes a hyphen and the project id follows a fixed prefix.
 */
export function projectTransitionName(projectId: string): string {
  return `project-${projectId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
}

/** The `view-transition-class` that crops a project photograph while it moves. */
export const PROJECT_TRANSITION_CLASS = 'project-photo';
