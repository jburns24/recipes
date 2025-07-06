---
mode: agent
description: Generate a recipe HTML page from a handwritten recipe image and integrate it into the recipe collection
tools: []
---

# Generate Recipe from Image

Convert a handwritten recipe from an image into a properly formatted HTML page that matches the existing recipe collection style and integrate it into the navigation.

## Task Overview

You will:
1. **Analyze the handwritten recipe image** to extract:
   - Recipe name
   - Ingredients list with quantities
   - Instructions/steps
   - Any cooking times or serving information
   - Special notes or tips

2. **Create an HTML recipe page** that:
   - Uses Bootstrap styling to match existing recipes like [mediterranean-salad.html](../../src/routes/dinner/salad/mediterranean-salad.html)
   - Follows the consistent layout structure with cards and proper spacing
   - Includes responsive design elements
   - Places the recipe image at the bottom of the card

3. **Update the navigation** in [index.html](../../src/index.html):
   - Add the new recipe link in the appropriate category
   - Maintain alphabetical ordering within categories
   - Use consistent file path formatting

4. **Organize files properly**:
   - Place HTML file in appropriate category folder under `src/routes/`
   - Ensure any recipe images are in the same directory as the HTML file
   - Use kebab-case naming for files (e.g., `elote-salad.html`)

## Style Requirements

Match the existing recipe format:
- **Layout**: Bootstrap card-based design with `container py-5`, centered layout
- **Typography**: `h1` for title with `card-title text-center mb-4`, `h5` for main sections, `h6` for subsections
- **Sections**: Include recipe meta (prep/cook time, servings), ingredients, instructions, and tips/notes
- **Image**: Place at bottom with styling: `max-width: 350px; width: 100%; height: auto; border-radius: 8px; margin-top: 1rem;`
- **Responsive**: Mobile-friendly with proper Bootstrap grid classes

## File Structure

Create files following this pattern:
```
src/routes/[category]/[subcategory]/recipe-name.html
src/routes/[category]/[subcategory]/recipe-name.jpg
```

Common categories:
- `breakfast/`
- `dinner/quick/`, `dinner/salad/`, `dinner/bbq/`
- `drinks/`
- `snacks/`, `snacks/dehydrator/`
- `thanksgiving/`

## Expected Output

1. **New HTML recipe file** with:
   - Proper Bootstrap styling
   - Complete ingredient list with measurements
   - Step-by-step instructions
   - Recipe metadata (times, servings)
   - Tips and notes section
   - Recipe image displayed prominently

2. **Updated index.html** with:
   - New recipe added to appropriate section
   - Maintained alphabetical order
   - Correct relative path to the recipe

## Variables

- `${input:recipeName}`: Override the detected recipe name
- `${input:category}`: Specify the category if not obvious from the recipe type

## Example Usage

```
/recipe-from-image
```

Then attach the handwritten recipe image to extract and format the recipe information.
