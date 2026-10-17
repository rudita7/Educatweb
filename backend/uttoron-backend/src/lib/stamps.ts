// Which lesson ids earn which home-page stamp. This mirrors STAMP_REQUIRES in
// uttoron-frontend/webapp/index1.html and analytics.html — a stamp for a
// multi-lesson track is earned when every one of its real lesson ids is done
// (the lessons never write a flag under the track's own id). Keep the three
// copies in sync when a lesson is added to a track.
export const STAMP_IDS = [
  'typing',
  'spreadsheet',
  'data-accuracy',
  'presentation-skills',
  'comms',
  'email',
  'cv',
  'career',
] as const;

const STAMP_REQUIRES: Record<string, string[]> = {
  'presentation-skills': [
    'ps-lesson1-getting-started', 'ps-lesson2-template', 'ps-lesson3-structure',
    'ps-lesson4-text', 'ps-lesson5-visuals', 'ps-lesson6-motion', 'ps-lesson7-notes',
    'ps-lesson8-proofread', 'ps-lesson9-checkpoint', 'ps-lesson10-saving',
    'ps-lesson11-slideshow', 'ps-lesson12-delivery', 'ps-lesson13-capstone',
  ],
  'data-accuracy': [
    'lesson1-find-errors', 'lesson2-correct-records',
    'lesson3-data-cleaning', 'lesson4-workplace-qa',
  ],
};

export function earnedStamps(blob: unknown): string[] {
  const prog = blob && typeof blob === 'object' ? (blob as Record<string, unknown>) : {};
  return STAMP_IDS.filter((id) => {
    const needed = STAMP_REQUIRES[id];
    if (needed) return prog[id] === true || needed.every((n) => prog[n] === true);
    return prog[id] === true || (id === 'spreadsheet' && prog['spreadsheet-basics'] === true);
  });
}
