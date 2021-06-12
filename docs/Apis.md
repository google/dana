# Dana APIs

Dana provides some APIs to add builds, build annotations, series and samples. APIs are accessible using [POST http requests](#usingPost) or using a [node client using WebSockets](#usingClient).

## APIs

### <a name="addBuild"></a>addBuild

**addBuild** is used to add a new build. The request must contain the following properties:
- *projectId*, the project you want to add the build,
- *build.buildId*, the ID of the build,
- *build.infos.hash*, the hash of the ToT commit for that build,
- *build.infos.abbrevHash*, the abbrevHash of the ToT commit for that build,
- *build.infos.authorName*, the authorName of the ToT commit for that build,
- *build.infos.authorEmail*, the authorEmail of the ToT commit for that build,
- *build.infos.subject*, the subject of the ToT commit for that build,
- *build.infos.url*, optional, an url to show the ToT commit for that build. If undefined, no urls will be shown
- *override*, optional, default value is false. If override is true, then build.infos will override previous ones for that buildId if there are any.

Example:

```
{
  "projectId": "Test",
  "build": {
    "buildId": 1000,
    "infos": {
      "hash": "hash_build_1000",
      "abbrevHash": "abbrevHash_build_1000",
      "authorName": "authorName",
      "authorEmail": "authorEmail",
      "subject": "Dummy build 1000",
      "url": "http://url_build_1000"
    }
  }
}
```

### <a name="addSerie"></a>addSerie

**addSerie** is used to add a new benchmark/test. The request must contain the following properties:
- *projectId*, the project you want to add the benchmark/test,
- *serieId*, the ID of the benchmark/test you want to add,
- *description*, optional, the description of the benchmark/test you want to add,
- *infos*, optional, the infos of the benchmark/test you want to add,

Additional properties for the analysis (see [Regression configuration](Principles.md#regressions))
- *analyse.base*, optional, the buildId to start the analysis,

In case of a test
- *analyse.test*, indicates it is a test,
- *analyse.test.propagate*, optional indicates it propagation apply (true),

In case of a benchmark
- *analyse.benchmark.range*, the range to use for average computation (i.e. '5%' for 5% range up/down, 5, for +/- 5 range),
- *analyse.benchmark.required*, the number of required samples to confirm an average, can be used for noise elimination,
- *analyse.benchmark.trend*, 'smaller' to indicate that smaller is better for benchmark results, 'higher' to indicate that higher is better for benchmark results.

- *override*, optional, default value is false. If override is true, then description, infos, analyse will override previous values for that serieId if there are any.

Example:

```
{
  "projectId": "Test",
  "serieId": "serie.dummy.11",
  "analyse": {
    "benchmark": {
      "range": "5%",
      "required": 2,
      "trend": "smaller"
    }
  }
}
```

### <a name="addSample"></a>addSample

**addSample** is used to add a new sample to a serieId. The request must contain the following properties:
- *projectId*, the project you want to add the sample,
- *serieId*, the serieId you want to add the sample,
- *sample* or *samples* must be set. *sample* contains one sample, *samples* contains an array of samples.
- one sample contains *buildId*, the buildId for that sample, *value*, the value for that sample (true/false for tests) (non zero integer for benchmarks), and *sample.url*, optional, an url (to the sponge logs for example).
- *override*, optional, default value is false. If override is true, then sample will override previous value for that buildId if there are any,
- *skipAnalysis*, optional, default value is false. If skipAnalysis is true, then the analysis will not be done. This can be used to push lots of existing samples, and apply only the analysis on new ones. Note that the series will not appear on test or benchmark summary page until an analysis is done.

Example:

```
{
  "projectId": "Test",
  "serieId": "serie.dummy.11",
  "sample": {
    "buildId": 1000,
    "value": 748
  }
}

{
  "projectId": "Test",
  "serieId": "serie.dummy.11",
  "samples": [
    {
      "buildId": 1000,
      "value": 748
    },
    {
      "buildId": 1001,
      "value": 750
    },
    {
      "buildId": 1002,
      "value": 751
    }
  ]
}
```

### <a name="getBuild"></a>getBuild

**getBuild** is used to get samples from a build. The request must contain the following properties:
- *projectId*, the project you want to add the build,
- *buildId*, the ID of the build.

Example:

```
{
  "projectId": "Test",
  "buildId": 1000,
}
```

It returns a JSON dictionary containing serieIds and their sample values.

_Note: right now this only supports querying information for benchmark builds._

## <a name="usingPost"></a>Using http POST requests

Dana supports POST http requests with Content-Type **application/json**.

Below examples using curl.

### addBuild

The relative url to use is `/apis/addBuild`. Below an example of addBuild using curl.

```
curl -d '{"projectId":"Test","build":{"buildId":1000,"infos":{"hash":"hash_build_1000","abbrevHash":"abbrevHash_build_1000","authorName":"authorName","authorEmail":"authorEmail","subject":"Dummy build 1000","url":"http://url_build_1000"}}}'
  -H "Content-Type: application/json"
  -X POST http://dana.myserver.com/apis/addBuild'
```
### addSerie

The relative url to use is `/apis/addSerie`. Below an example of addSerie using curl.

```
curl -d '{"projectId":"Test","serieId":"serie.dummy.11","analyse":{"benchmark":{"range":"5%", "required":2, "trend":"smaller"}}}'
  -H "Content-Type: application/json"
  -X POST http://dana.myserver.com/apis/addSerie'
```
### addSample

The relative url to use is `/apis/addSample`. Below an example of addSample using curl.

```
curl -d '{"projectId":"Test","serieId":"serie.dummy.11","sample":{"buildId":1000,"value":748}}'
  -H "Content-Type: application/json"
  -X POST http://dana.myserver.com/apis/addSample'
```

## <a name="usingClient"></a> Node client using WebSockets

A skeleton of a nodejs client is available in dana-websocket-client directory. It relies on the *ws* npm module. You can adapt it for example to transfer an existing database to Dana.

To use it, first edit `dana-websocket-client/client.js` and update the **url** to the right dana server url.

Then:

```
$ cd dana-websocket-client
$ npm install
$ node client.js
```
