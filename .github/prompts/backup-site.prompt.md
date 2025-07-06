# Goal

Your goal is to take a link and a relative path and use SingleFile cli to create
a backup of the page supplied to the path specified.

# Instructions

- You must be given the following:
    - A link to a webpage (e.g., `https://example.com/page.html`) I will refer to this as `SOURCE`.
    - A relative path to `src/routes` where the backup should be saved (e.g., `dinner/quick/new_recipe.html`) I will refer to this as `RELATIVE_PATH`.
        - If a user gives you `dinner/quick/new_recipe.html` you should save the file as `src/routes/dinner/quick/new_recipe.html` I will refer to this as `PATH_TO_SAVE_BACKUP`. If the path does not include a .html extension, append `.html` to the end of the path.
- Verify the relative path does not exist with: `[ -d "<PATH_TO_SAVE_BACKUP>" ] && echo "Exists" || echo "Does not exist"`
    - If the path does not exist make it with `mkdir -p <PATH_TO_SAVE_BACKUP>`
- Fetch the SingleFile CLI binary and store it in a temporary directory.
- Run SingleFile CLI to save the webpage to the specified path.
    - example command: `tmp/single-file "<SOURCE>" "<PATH_TO_SAVE_BACKUP>" --dump-content`


# Output
After you run you should return the following output:
FILE_ADDED=<RELATIVE_PATH_TO_SAVE_BACKUP>


## SingleFile CLI Installation
You are going to leverage the binary version of SingleFile CLI. First you need to figure out what arch and os you are running on. Then download the appropriate binary from the [SingleFile CLI releases page](https://github.com/gildas-lormeau/single-file-cli/releases/tag/v2.0.75
1. To get the list of available releases, you can use the following command:
    ```bash
    curl -s https://api.github.com/repos/gildas-lormeau/single-file-cli/releases/tags/v2.0.75 \
  | jq '.assets[] | {name: .name, download_url: .browser_download_url}'
    ```
2. Then use shell commands to determine the OS and arch of the system. Start with nix commands then try windows commands
3. Then compare the systems os and arch with the available releases. Find the best match and ask for confirmation before downloading.
