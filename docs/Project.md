# Project pages

After setting up a project in the system in the UI interface, Dana can agglomerate data and apply regression analysis and comparisons.

To view results for a particular project, some additional works are required to create the web pages that will be shown.

Note that Dana uses **ejs** to for pages rendering.

## Where to store page projects

Each project has a projectId and a directory in www/views/projects with projectId name must be created and used to store pages.

## Sidebar

A **sibebar.ejs** file must be in the project directory. It defines the sidebar that will be presented on the left side of the web pages. Feel free to look to **demo/projects/Test/sidebar.ejs** for example of use. Note that all link should point to the projectId.

## Other pages

In **demo/projects/Test/** there are some pages that can be used for templates. Feel free to look to them, or create your own ones.

### Overall summary

See **demo/projects/Test/statusOverall.ejs** for an example. Just copy it in your project and update the projectId to yours in the setOverallPage call.

`
setOverallPage({
  projectId: 'MyProjectId'
});
`

### Test series summary

See **demo/projects/Test/statusTests.ejs** for an example. Just copy it in your project and update the projectId to yours in the testsSetPage call.

`
testsSetPage({
  projectId: 'MyProjectId'
});
`

### Benchmark series summary

See **demo/projects/Test/statusSeries.ejs** for an example. Just copy it in your project and update the projectId to yours in the setSeriesPage call.

`
setSeriesPage({
  projectId: 'MyProjectId'
});
`

If you want to apply a filter on the series to only show some specific ones, add a **filter** option. Only series containing the filter string will be shown in the state

`
setSeriesPage({
  projectId: 'MyProjectId',
  filter:'buildTime'
});
`

### Compare series summary

See **demo/projects/Test/statusCompare_with_build_1000.ejs** for an example. Just copy it in your project. The name of the page should be the concatenation of 'status', the compareId, and '.ejs'. Then update the projectId  and compareId to yours in the setComparePage call.

`
setComparePage({
  projectId:'MyProjectId',
  compareId:'Compare_with_build_1000'
});
`

### Show graphs

See  **demo/projects/Test/showGraphss** for an example and a template you can reuse.

You must add in tables some objects that describe the tables that contain the graphs, and then indicate the page title, the projectId and the presentation order of the graphs. Dana provides a library to automatically show the graphs.

An example below:

`
pageSetTitle('Exemple of multiple graphs using MyProjectId project');
pageSetProject({
  projectId: 'MyProjectId'
}, function e() {
  pageAddTable("tableWidget0");
  pageAddTable("tableWidget1");
  pageAddTable("tableWidget2");
});
`

For each table, you have to update the getId function that takes the row and one of the series as parameter and you must returns the serieId to use for that table cell.

`
getId: function getIdBuild(row, serie) {
  return 'serie.dummy.' + (row.id + serie.id*4);
}
`
