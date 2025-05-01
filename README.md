# Recipe Site

## Disclaimer

**None of the recipes backed up in this repository are my own. They are simply recipes I have tried and liked, preserved here for personal use and convenience. All credit goes to the original authors and sources.**

## Purpose

A simple website to preserve and organize recipes I have used and liked. This project also serves as a playground for new Copilot features and prompt-driven workflows. The intent is to create a backup of recipes, which may include content from other websites.

## How to Use

Primary purpose of this repository is to use GitHub Copilot's prompt-driven workflows to back up recipes from the web. All these reusable prompts were tested and working well in VS Code (version 1.99.3 or later) with ChatGPT 4.1

1. Clone the repository:
   ```sh
   git clone <this-repo-url>
   ```
2. Open the project in VS Code (version 1.99.3 or later).
3. Open the Command Palette (`Cmd+Shift+P` on macOS).
4. Select `Chat: Use Prompt`, then select `_all`.
5. Enter the link you want to back up and the path where you want to save it, for example:
   ```
   link: https://www.eatwell101.com/healthy-chicken-vegetable-recipe
   path: dinner/quick/wingle-pan-chicken-vegetables.html
   ```
6. Review and accept the prompts to save the recipe.

## Adding a Recipe from a Written Recipe Image

You can add a new recipe by uploading a photo or scan of a written recipe using the reusable prompt [`generate-recipe-from-image.prompt.md`](.github/prompts/generate-recipe-from-image.prompt.md):

1. Copy the image file into the `src/routes` directory in the location you want (create any required directories). For example, to add a Mediterranean Salad recipe, place the image at `src/routes/dinner/salad/mediterranean-salad.jpg`.
2. In VS Code, open the Command Palette (`Cmd+Shift+P` on macOS).
3. Select `Chat: Use Prompt`, then select `generate-recipe-from-image.prompt.md`.
4. Paste the recipe image into the prompt context and also paste in `image_file:<RELATIVE_IMAGE_PATH>` (e.g., `image_file:src/routes/dinner/salad/mediterranean-salad.jpg`).
5. Follow the prompt to extract, review, and confirm the recipe details. The prompt will generate the corresponding `.html` file and update the navigation automatically.

## Refreshing Navigation

If you add, remove, or repurpose recipe files, you can quickly refresh the site's navigation using the special prompt in `.github/prompts/force-refresh-nav.prompt.md`. This will automatically rebuild the navigation in `src/index.html` to match all `.html` files in `src/routes`.

- See [`force-refresh-nav.prompt.md`](.github/prompts/force-refresh-nav.prompt.md) for details and instructions.

## Prerequisites

- Docker (Optional for running SingleFile CLI in a container)
  - If you prefer to run locally you will need: `jq`, chromium or google-chrome, and `curl` installed on your system.
- Nix-based system
- Git
- VS Code (v1.99.3 or later)
