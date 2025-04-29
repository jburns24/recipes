Your goal is to completely refresh the navigation of this simple website.

# Rules
- Use this command to get the list of all files::
  - `tree -L 3 -fi --noreport src/routes | grep '\.html$'`
  - internally I will refer to the output of this command as $ALL_FILES
- You are only to add links to the navigation for the paths found in $ALL_FILES
- Ensure that the links are properly formatted and point to the correct relative paths
- Make no other changes

# Example

Here is what an index.html should look like:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recipe Index</title>
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="icon" type="image/png" href="static/favicon.png">
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
├── dinner
│   └── quick
│       ├── <a href="routes/dinner/quick/chicken-and-broccoli-with-dill-sauce.html">chicken-and-broccoli-with-dill-sauce.html</a>
│       ├── <a href="routes/dinner/quick/sheet-pan-sausage-veggies.html">sheet-pan-sausage-veggies.html</a>
│       └── <a href="routes/dinner/quick/single-pan-chicken-vegetables.html">single-pan-chicken-vegetables.html</a>
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

This layout corresponds to the following directory structure in [./src/routes](../../src/routes):
```bash
➜  recipes git:(master) ✗ tree -L 3 -fi --noreport src/routes | grep '\.html$'
src/routes/dinner/quick/chicken-and-broccoli-with-dill-sauce.html
src/routes/dinner/quick/sheet-pan-sausage-veggies.html
src/routes/dinner/quick/single-pan-chicken-vegetables.html
src/routes/drinks/butter-beer.html
src/routes/snacks/beer-cheese.html
src/routes/snacks/dehydrator/beef-jerky.html
src/routes/snacks/dehydrator/cantaloupe-chips.html
src/routes/snacks/dehydrator/marshmallows.html
src/routes/snacks/dehydrator/pears.html
src/routes/snacks/dehydrator/pickle-chips.html
src/routes/snacks/dehydrator/zucchini-chips.html
src/routes/thanksgiving/pretzle-stuffing.html
```

The layout should always resemble the output of `tree`, for example
```bash
src/routes
├── dinner
│   └── quick
│       ├── chicken-and-broccoli-with-dill-sauce.html
│       ├── sheet-pan-sausage-veggies.html
│       └── single-pan-chicken-vegetables.html
├── drinks
│   └── butter-beer.html
├── snacks
│   ├── beer-cheese.html
│   └── dehydrator
│       ├── beef-jerky.html
│       ├── cantaloupe-chips.html
│       ├── marshmallows.html
│       ├── pears.html
│       ├── pickle-chips.html
│       └── zucchini-chips.html
└── thanksgiving
    └── pretzle-stuffing.html

7 directories, 12 files
```

If you need to get a visual for what the layout should look like run
```bash
tree /src/routes
```


# Steps
To achieve updating the navigation do the following:
1. First get ALL_FILES
2. Run tree to see what the layout should look like
3. Update [index.html](../../src/routes/index.html) with all the .html files found.
