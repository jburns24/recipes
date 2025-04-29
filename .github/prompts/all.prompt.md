Your goal is to get the backup of a webpage save to to a file stage that file in git and then generate an updated navigation for the site.

# Steps:
1. Run [add-site.prompt.md](add-site.prompt.md) to get the backup of a webpage saved to a file. Capture the output of this sub-prompt in a variable called `FILE_ADDED`.
2. Stage the file that was added by running `git add <RELATIVE_PATH_TO_SAVE_BACKUP>` where `<RELATIVE_PATH_TO_SAVE_BACKUP>` is the value of `FILE_ADDED`.
3. Run [regenerate-nav.prompt.md](regenerate-nav.prompt.md) to generate an updated navigation for the site.
