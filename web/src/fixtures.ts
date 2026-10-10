import type { RecipeDto } from './lib/types';

export const recipe = (over: Partial<RecipeDto> = {}): RecipeDto => ({
  slug: 'meatloaf',
  category: ['dinner', 'quick'],
  title: "Sym's Meatloaf",
  subtitle: 'Classic, comforting meatloaf.',
  prepTime: '15 minutes',
  cookTime: '1 hour',
  totalTime: '1 hour 15 minutes',
  serves: '6-8 people',
  ingredients: [
    { items: ['1 lb ground beef', '2 eggs'] },
    { group: 'For Serving', items: ['Fresh cilantro'] },
  ],
  instructions: [
    { lead: 'Preheat oven', text: 'Preheat oven to 350F.' },
    { text: 'Bake for an hour.' },
  ],
  tips: ['Let it rest.', 'Leftovers make sandwiches.'],
  image: '/api/images/dinner/quick/meatloaf.jpg',
  path: 'dinner/quick/meatloaf',
  ...over,
});
