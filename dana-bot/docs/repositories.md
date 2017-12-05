# Repositories description

## Public Repositories

The bot can monitor public repositories that don't require authentication. Just use the url as you will do to do a git clone.

## Private Repositories

To use a private git repository located on your machine (for example *~/myWorkingRepo*).

### If dana-bot is running on the same machine
Use ``file://~/myWorkingRepo`` as git url.

### If dana-bot is running on another machine
One solution is to use git daemon not make it accessible in read-only from another machine. For example, if repo is on *mymachine.com*

```
$ cd ~/myWorkingRepo
$ git daemon --base-path=. --export-all --reuseaddr --informative-errors --verbose
```
Then use ``git://mymachine.com/`` as git url.  
