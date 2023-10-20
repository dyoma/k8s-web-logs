## How to Use It
### Prepare kubeConfig.yml
1. Find you `env.sh` you use to configure kubectl and docker (example location: `$HOME/.kube/dyoma-1.dev.alm.works/env.sh`)
2. Run it in terminal. In the same terminal run `kubectl config view --raw > kubeConfig.yml`
3. Edit the generated file and add absolute paths to settings: `certificate-authority`, `client-certificate`, `client-key`.
   The absolute paths are path to your `env.sh`
4. Move your `kubeConfig.yml` file to [kubeConfig.yml](src/main/resources/kubeConfig.yml)

### Prepare the Web App
* If you changed server port from default (8123) you need to update [index.tsx](logs-viewer/src/ui/index.tsx)
* In terminal `cd` to [logs-viewer](logs-viewer)
* Run `npm install`
* Run `npm run build`. Other options are: `build-dev` and `build-watch`

### Run the App
 * [ClusterLogs.kt](src/main/kotlin/com/almworks/dyoma/kubenetes/logs/apps/ClusterLogs.kt) loads logs from the cluster (defined by `kubeConfig.yml`)
 * [ReadLogs.kt](src/main/kotlin/com/almworks/dyoma/kubenetes/logs/apps/ReadLogs.kt) loads logs from files 
   You can download the log files from K8s Dashboard
 * While your server is running your may share it via [ngrok](https://ngrok.com/): `ngrok http 8123` and send the link to your colleagues 

The server serves static content (the WebApp). 
Its location is configured in the `staticContent.path` property in [server.properties](src/main/resources/com/almworks/dyoma/kubenetes/logs/server/server.properties). 

## Know Problems
* **Server.** All logs loaded from the cluster remains in JVM heap forever. So, the server consumes more memory than needed.

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