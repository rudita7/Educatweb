import { DecisionTreeInput, DecisionTreeResult } from '@/types';

export const recommendTrack = (input: DecisionTreeInput): DecisionTreeResult => {
  const { interests, previousExperience, timeCommitment } = input;

  if (interests.includes('typing') || interests.includes('office')) {
    return {
      recommendedTrack: 'Track 1: Data Entry & Office Computing',
      reasoning: 'Based on your interest in typing and office tasks, this track will build your foundational digital skills.',
    };
  }

  if (interests.includes('design') || interests.includes('creative')) {
    return {
      recommendedTrack: 'Track 5: Graphic & Content Basics',
      reasoning: 'Your creative interests suggest you would enjoy learning the basics of graphic design and content creation.',
    };
  }

  if (previousExperience && timeCommitment === 'high') {
    return {
      recommendedTrack: 'Track 4: Freelance & Gig Readiness',
      reasoning: 'With your experience and high availability, you are ready to learn how to find work online.',
    };
  }

  // Default recommendation
  return {
    recommendedTrack: 'Track 1: Data Entry & Office Computing',
    reasoning: 'This is our foundational track, perfect for getting started with vocational digital skills.',
  };
};
