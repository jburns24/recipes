import type { Recipe } from '@recipes/shared';

export const soup: Recipe = {
  slug: 'soup',
  category: ['dinner', 'quick'],
  title: 'Soup',
  ingredients: [{ items: ['water'] }],
  instructions: [{ text: 'Boil.' }],
  tips: [],
};

export const salad: Recipe = {
  slug: 'salad',
  category: ['dinner', 'salad'],
  title: 'Salad',
  serves: '2',
  ingredients: [{ items: ['lettuce'] }],
  instructions: [{ lead: 'Toss', text: 'Everything.' }],
  tips: ['Chill first'],
  image: 'dinner/salad/salad.jpg',
};

export const tea: Recipe = { ...soup, slug: 'tea', category: ['drinks'], title: 'Tea' };
