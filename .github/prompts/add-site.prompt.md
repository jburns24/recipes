Your goal is to take a link and a relative path and use SingleFile cli to add a backup of the page supplied to the path specified.

# Instructions
- You are to be given the following:
    - A link to a webpage (e.g., `https://example.com/page.html`)
    - A relative path to `src/routes` where the backup should be saved (e.g., `dinner/quick/new_recipe.html`)
    - If you do not get these things prompt for them.
- Before generating backup verify link is valid and reachable by running
    - `curl -Is <LINK> | head -n 1`
    - If the link is not reachable, prompt for a new link.
- Verify the relative path does not exist with: `[ -d "<RELATIVE_PATH>" ] && echo "Exists" || echo "Does not exist"`
    - If the path does not exist make it with `mkdir -p <RELATIVE_PATH_TO_SAVE_BACKUP>`
- Run singlefile cli in a docker container
    - run command `docker run capsulecode/singlefile "https://www.wikipedia.org" > <RELATIVE_PATH_TO_SAVE_BACKUP>`

# Output
After you run you should return the following output:
FILE_ADDED=<RELATIVE_PATH_TO_SAVE_BACKUP>
