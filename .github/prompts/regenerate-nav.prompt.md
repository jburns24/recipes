Your goal is to regenerate the navigation of this simple website.

# Rules
- You are to get the relative paths of the pages to add from running and reading the output of the following command:
  - `git diff --cached --name-status | awk '$1 == "A" {print $2}' | grep "src/routes"`
  - internally I will refer to the output of this command as $ADDED_FILES
- You are only to add links to the navigation for the paths found in $ADDED_FILES
- Ensure that the links are properly formatted and point to the correct relative paths
- Do not remove any existing links from the navigation
- Make no other changes

# Example

Current index.html:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recipe Index</title>
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
      body { background: #f8f9fa; }
      h1 { margin-top: 2rem; }
      a { text-decoration: none; }
      a:hover { text-decoration: underline; }
    </style>
</head>
<body class="container">
    <h1 class="text-center">Recipe Index</h1>
    <pre style="background:#fff;border-radius:8px;padding:2rem;max-width:700px;margin:2rem auto;font-size:1.1rem;">
.
├── drinks
│   └── <a href="routes/drinks/butter-beer.html">butter-beer.html</a>
├── snacks
│   ├── <a href="routes/snacks/beer-cheese.html">beer-cheese.html</a>
│   └── dehydrator
│       ├── <a href="routes/snacks/dehydrator/beef-jerky.html">beef-jerky.html</a>
│       ├── <a href="routes/snacks/dehydrator/cantaloupe-chips.html">cantaloupe-chips.html</a>
│       ├── <a href="routes/snacks/dehydrator/marshmallows.html">marshmallows.html</a>
│       ├── <a href="routes/snacks/dehydrator/pears.html">pears.html</a>
│       ├── <a href="routes/snacks/dehydrator/pickle-chips.html">pickle-chips.html</a>
│       └── <a href="routes/snacks/dehydrator/zucchini-chips.html">zucchini-chips.html</a>
└── thanksgiving
    └── <a href="routes/thanksgiving/pretzle-stuffing.html">pretzle-stuffing.html</a>
    </pre>
</body>
</html>
```

Corresponds to the following directory structure in [./src/routes](../../src/routes):
```bash
.
├── drinks
│   └── butter-beer.html
├── snacks
│   ├── beer-cheese.html
│   └── dehydrator
│       ├── beef-jerky.html
│       ├── cantaloupe-chips.html
│       ├── marshmallows.html
│       ├── pears.html
│       ├── pickle-chips.html
│       └── zucchini-chips.html
└── thanksgiving
    └── pretzle-stuffing.html
```

So if we were to add a new category and recipe that resulted in the following $ADDED_FILES:
```bash
$ git diff --cached --name-status | awk '$1 == "A" {print $2}' | grep "src/routes"
src/routes/dinner/quick/chicken-and-broccoli-with-dill-sauce.html
```

This would result in the following updated index.html:
```html
...
<body class="container">
    <h1 class="text-center">Recipe Index</h1>
    <pre style="background:#fff;border-radius:8px;padding:2rem;max-width:700px;margin:2rem auto;font-size:1.1rem;">
.
├── drinks
│   └── <a href="routes/drinks/butter-beer.html">butter-beer.html</a>
├── dinner
│   └── quick
│       └── <a href="routes/dinner/quick/chicken-and-broccoli-with-dill-sauce.html">chicken-and-broccoli-with-dill-sauce.html</a>
├── snacks
│   ├── <a href="routes/snacks/beer-cheese.html">beer-cheese.html</a>
│   └── dehydrator
│       ├── <a href="routes/snacks/dehydrator/beef-jerky.html">beef-jerky.html</a>
│       ├── <a href="routes/snacks/dehydrator/cantaloupe-chips.html">cantaloupe-chips.html</a>
│       ├── <a href="routes/snacks/dehydrator/marshmallows.html">marshmallows.html</a>
│       ├── <a href="routes/snacks/dehydrator/pears.html">pears.html</a>
│       ├── <a href="routes/snacks/dehydrator/pickle-chips.html">pickle-chips.html</a>
│       └── <a href="routes/snacks/dehydrator/zucchini-chips.html">zucchini-chips.html</a>
└── thanksgiving
    └── <a href="routes/thanksgiving/pretzle-stuffing.html">pretzle-stuffing.html</a>
    </pre>
</body>
...
```

# Steps
To achieve updating the navigation do the following:
1. Run the command `git diff --cached --name-status | awk '$1 == "A" {print $2}' | grep "src/routes"` in the terminal to get the list of added files.
  a. If you do not see any output, see if the author forgot to stage the new files. First by running `git status` to check if there are any untracked files. Then `git add .` to stage them if necessary. If you have to do this start from step 1 again.
2. Update [index.html](../../src/routes/index.html) with the new links based on the output of the command.
