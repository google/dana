# Tasks

The project defines the task that can be executed by the bot. In order to schedule them,
the web interface provides a way to add or edit tasks configurations.

A task is identified with a name and is associated to a specific repository and a run defined in the project.

Each tack has a base that corresponds to the last commit that has been used to run tests/benchmarks.

There are 2 modes of monitoring: patch (each patch will be run from the base to the ToT) or patchSet (the last ToT is used, skipping the run of all the patches between the Tot and the base).

The monitoring can be done at a specific time, or every tick period (one tick is 1 second).

At last when each task is done an notification email can be send to the notify people associated to the task.
