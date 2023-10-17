## How to Use It
### Prepare kubeConfig.yml
1. Find you `env.sh` you use to configure kubectl and docker (example location: `$HOME/.kube/dyoma-1.dev.alm.works/env.sh`)
2. Open and update [GenerateConfig.kt](src/main/kotlin/com/almworks/dyoma/kubenetes/logs/apps/GenerateConfig.kt)
3. Run `GenerateConfig.kt`
4. Create [kubeConfig.yml](src/main/resources/com/almworks/dyoma/kubenetes/logs/server/kubeConfig.yml) with the generated content.
### Choose PODs
The [ClusterLogs.kt](src/main/kotlin/com/almworks/dyoma/kubenetes/logs/apps/ClusterLogs.kt) starts the server which 
loads logs from the cluster and makes the available for the web app.
 * You may configure server port in the [server.properties](src/main/resources/com/almworks/dyoma/kubenetes/logs/server/server.properties)
 * Choose PODs you want to load logs from:
    ```kotlin
    client.listPods("default")
    //.filter { it.name == "front-0" } // Uncomment to choose PODs you want to load logs from
      .forEach(extractor::loadLogs)
    ```
Run `ClusterLogs.kt` and find the loaded logs at: http://localhost:8123/api/events?sid=0

You share your server via [ngrok](https://ngrok.com/): `ngrok http 8123` and send the link to your colleagues.
### Prepare the Web App
* If you changed server port from default (8123) you need to update [index.tsx](logs-viewer/src/ui/index.tsx)
* In terminal `cd` to [logs-viewer](logs-viewer)
* Run `npm install`
* Run `npm run build`. Other options are: `build-dev` and `build-watch`

The server serves static content (the WebApp). 
Its location is configured in the `staticContent.path` property in [server.properties](src/main/resources/com/almworks/dyoma/kubenetes/logs/server/server.properties). 

## Know Problems
* **Server.** All logs loaded from the cluster remains in JVM heap forever. So, the server consumes more memory than needed.
* **Server.** Stops loading logs on POD shutdown (including restart and temporary PODs such as Jobs).
  * Server restart (and webapp reload) is required to continue monitoring of the restarted POD. 
  * Previous log records (before restart) are lost. 

## Features
* Load exported logs from files. See [ReadLogs.kt](src/main/kotlin/com/almworks/dyoma/kubenetes/logs/apps/ReadLogs.kt)
* Group exceptions by exception class
* All records are order by timestamp
* View all log records from all PODs
  * New records appears on top
  * Filter by log level and/or source POD
  * Filter by text: case-insensitive search for the substring over all fields of log records
  * Show log level and mark records with a stack trace (as "Ex") 
* Limit all log views to log record newer than an instant
  * Convenient button to see only records from now on
  * This limit has no effect on the View traceId feature
* Log records has links to view all records in the same
  * traceId
  * span