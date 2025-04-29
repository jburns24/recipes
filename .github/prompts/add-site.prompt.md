Your goal is to take a link and a relative path and use SingleFile cli to add a backup of the page supplied to the path specified.

# Instructions
- You are to be given the following:
    - A link to a webpage (e.g., `https://example.com/page.html`)
    - A relative path to `src/routes` where the backup should be saved (e.g., `dinner/quick/new_recipe.html`)
    - If you do not get these things prompt for them.
- Run singlefile cli in a docker container
    - run command `docker run capsulecode/singlefile "https://www.wikipedia.org" > <RELATIVE_PATH_TO_SAVE_BACKUP>`
- Before generating backup verify link is valid and reachable by running
    - `curl -Is <LINK> | head -n 1`
    - If the link is not reachable, prompt for a new link.

# Output
After you run you should return the following output:
FILE_ADDED=<RELATIVE_PATH_TO_SAVE_BACKUP>
