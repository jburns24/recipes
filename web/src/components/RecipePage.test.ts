import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { recipe } from '../fixtures';
import RecipePage from './RecipePage.svelte';

describe('RecipePage', () => {
  it('renders every section', () => {
    render(RecipePage, { recipe: recipe() });
    expect(screen.getByRole('heading', { level: 1, name: "Sym's Meatloaf" })).toBeInTheDocument();
    expect(screen.getByTestId('recipe-title')).toHaveClass('card-title', 'text-center', 'mb-4');
    expect(screen.getByText('Classic, comforting meatloaf.')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-meta')).toHaveTextContent(
      'Prep Time: 15 minutesCook Time: 1 hourTotal Time: 1 hour 15 minutesServes: 6-8 people',
    );
    expect(screen.getByRole('heading', { name: 'Ingredients' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 6, name: 'For Serving' })).toBeInTheDocument();
    expect(screen.getAllByRole('list')).toHaveLength(4);
    expect(screen.getByText('Preheat oven:').tagName).toBe('STRONG');
    expect(screen.getByText('Bake for an hour.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tips & Notes' })).toBeInTheDocument();
    expect(screen.getByAltText("Sym's Meatloaf")).toHaveAttribute(
      'src',
      '/api/images/dinner/quick/meatloaf.jpg',
    );
  });

  it('omits optional parts when absent', () => {
    render(RecipePage, {
      recipe: recipe({
        subtitle: undefined,
        prepTime: undefined,
        cookTime: undefined,
        totalTime: undefined,
        serves: undefined,
        tips: [],
        image: undefined,
        ingredients: [{ items: ['Salt'] }],
      }),
    });
    expect(screen.queryByTestId('recipe-subtitle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recipe-meta')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Tips & Notes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recipe-source')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 6 })).not.toBeInTheDocument();
  });

  it('shows only the meta lines that exist and a source link', () => {
    render(RecipePage, {
      recipe: recipe({
        prepTime: undefined,
        cookTime: undefined,
        source_url: 'https://example.com/r',
      }),
    });
    const meta = screen.getByTestId('recipe-meta');
    expect(meta).not.toHaveTextContent('Prep Time');
    expect(meta).toHaveTextContent('Total Time: 1 hour 15 minutesServes: 6-8 people');
    expect(screen.getByTestId('recipe-source')).toHaveAttribute('href', 'https://example.com/r');
  });
});
