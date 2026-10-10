import type { Recipe } from '@recipes/shared';

export interface Override {
  /** Fields merged over whatever the parser produced. */
  patch?: Partial<Omit<Recipe, 'slug' | 'category' | 'image'>>;
  /** Substring identifying the hero <img> (matched against its non-src attributes). */
  imageMatch?: string;
  /** File under api/seed-assets/ used when the snapshot has no inline image. */
  imageFile?: string;
}

/**
 * Hand fixes keyed by "category/path/slug", for snapshots whose page has no
 * schema.org Recipe JSON-LD (prose-only blog posts) or where the JSON-LD title
 * is not the dish name.
 */
export const overrides: Record<string, Override> = {
  'dinner/quick/chicken-and-broccoli-with-dill-sauce': {
    // Snapshot has no inline image; the og:image (tasteofhome.com) was downloaded once.
    imageFile: 'chicken-and-broccoli-with-dill-sauce.jpg',
  },
  'drinks/butter-beer': {
    patch: { title: 'Butterbeer' }, // JSON-LD name is "Print Butterbeer Recipe #5"
    imageMatch: 'wp-image-6270',
  },
  'thanksgiving/pretzle-stuffing': { imageMatch: 'as seen on Girl Meets Farm' },
  'snacks/dehydrator/marshmallows': { imageMatch: 'itemprop=image' },
  'snacks/dehydrator/cantaloupe-chips': {
    imageMatch: 'wp-image-7625',
    // brooklynfarmgirl.com post is prose with no recipe card; transcribed by hand.
    patch: {
      title: 'Cantaloupe Chips',
      subtitle: 'Naturally sweet, leathery-crunchy dehydrated cantaloupe.',
      cookTime: '16 to 18 hours',
      ingredients: [{ items: ['Cantaloupes (as many as you like)'] }],
      instructions: [
        { text: 'Spoon the seeds out of the cantaloupes.' },
        {
          text: 'Cut each cantaloupe in half, then each half into fourths, then cut the fourths into 1/2 inch slices. Thicker slices take much longer to dry; thinner ones will not turn into chips.',
        },
        { text: 'Arrange the slices on your dehydrator sheets.' },
        {
          text: 'Dehydrate at 135 degrees F for 16-18 hours. Cantaloupe is juicy, so put it on the bottom shelves if you are drying other things.',
        },
        {
          text: 'Check around the 16 hour mark. Stop when they are as crisp or leathery as you like; closer to 18 hours is crisp but still tastes like fruit leather.',
        },
        { text: 'Store in mason jars.' },
      ],
      tips: ['Measure the first few slices to get a feel for 1/2 inch.'],
    },
  },
  'snacks/dehydrator/pickle-chips': {
    imageMatch: 'wp-image-830',
    // rockinwhomestead.com post is prose with no recipe card; transcribed by hand.
    patch: {
      title: 'Dehydrated Pickle Chips',
      subtitle: 'Portable, salty, intensely pickle-flavored chips. For serious pickle lovers only.',
      cookTime: '4 to 6 hours',
      ingredients: [
        {
          items: [
            'A jar of pickles (whole, spear, or chip cut; kosher dill, sweet dill, or homemade)',
          ],
        },
        {
          group: 'Pickling brine for rehydrating (1 pint)',
          items: [
            '16 ounces water',
            '1/4 cup granulated sugar',
            '1 tablespoon pickling salt',
            '3 ounces distilled white vinegar (5% acidity)',
            '2 tablespoons pickling spice',
            '1 tablespoon dill seed',
          ],
        },
      ],
      instructions: [
        {
          text: 'Take pickle slices out of the jar and pat until slightly damp. If using whole pickles, cut them into evenly sized slices.',
        },
        {
          text: 'Arrange the chips on dehydrator trays. They can touch but should not overlap.',
        },
        {
          text: 'Dry at 135 degrees F for 4 to 6 hours. With a bottom-heating dehydrator, rotate the trays halfway through; check after 2 to 3 hours.',
        },
        {
          lead: 'Rehydrating (optional)',
          text: 'Put pickling spice and dill seed in a 1-quart jar. Boil water, sugar, salt and vinegar, pour over the spices, cool, cap and refrigerate 2 days. Soak the chips in the brine; plain water will not bring back the pickle flavor.',
        },
      ],
      tips: ['Quite salty; a large pickle makes about 10 slices, so they are easy to overeat.'],
    },
  },
};
