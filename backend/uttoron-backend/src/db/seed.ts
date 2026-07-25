import { db } from '@/db';
import { tags } from '@/db/schema';

// Tag taxonomy — seeded exactly per build spec §7.
const TAGS = [
  { slug: 'structure-clear', label: 'Clear, logical flow', rubricCategory: 'structure', sentiment: 'positive' },
  { slug: 'structure-hard', label: 'Structure was hard to follow', rubricCategory: 'structure', sentiment: 'constructive' },

  { slug: 'visual-clean', label: 'Clean, consistent slides', rubricCategory: 'visual_design', sentiment: 'positive' },
  { slug: 'visual-inconsistent', label: 'Inconsistent fonts, colors, or alignment', rubricCategory: 'visual_design', sentiment: 'constructive' },

  { slug: 'restraint-supported', label: 'Transitions and animations supported the content', rubricCategory: 'restraint', sentiment: 'positive' },
  { slug: 'restraint-distracting', label: 'Animations/transitions were distracting', rubricCategory: 'restraint', sentiment: 'constructive' },

  { slug: 'pacing-well', label: 'Well-paced, with natural pauses', rubricCategory: 'pacing', sentiment: 'positive' },
  { slug: 'pacing-rushed', label: 'Felt rushed', rubricCategory: 'pacing', sentiment: 'constructive' },
  { slug: 'pacing-dragged', label: 'Dragged in places', rubricCategory: 'pacing', sentiment: 'constructive' },

  { slug: 'vocal-confident', label: 'Confident, varied tone', rubricCategory: 'vocal_delivery', sentiment: 'positive' },
  { slug: 'vocal-filler', label: 'Noticeable filler words', rubricCategory: 'vocal_delivery', sentiment: 'constructive' },
  { slug: 'vocal-monotone', label: 'Monotone delivery', rubricCategory: 'vocal_delivery', sentiment: 'constructive' },

  { slug: 'time-within', label: 'Within the time target', rubricCategory: 'time_management', sentiment: 'positive' },
  { slug: 'time-over', label: 'Ran over time', rubricCategory: 'time_management', sentiment: 'constructive' },
  { slug: 'time-short', label: 'Too short / underdeveloped', rubricCategory: 'time_management', sentiment: 'constructive' },
];

async function seed() {
  console.log('Seeding tags...');
  for (const tag of TAGS) {
    await db.insert(tags).values(tag).onConflictDoNothing({ target: tags.slug });
  }
  console.log(`Seeded ${TAGS.length} tags.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
