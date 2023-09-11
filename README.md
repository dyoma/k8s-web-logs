## How to Use It
### Prepare kubeConfig.yml
1. Find you `env.sh` you use to configure kubectl and docker (example location: `$HOME/.kube/dyoma-1.dev.alm.works/env.sh`)
2. Open and update [GenerateConfig.kt](src/main/kotlin/com/almworks/dyoma/kubenetes/logs/GenerateConfig.kt)
3. Run `GenerateConfig.kt`
4. Create [kubeConfig.yml](src/main/resources/com/almworks/dyoma/kubenetes/logs/server/kubeConfig.yml) with the generated content.
### Choose PODs
The [RunServer.kt](src/main/kotlin/com/almworks/dyoma/kubenetes/logs/server/RunServer.kt) starts the server which 
loads logs from the cluster and makes the available for the web app.
 * You may configure server port in the [server.properties](src/main/resources/com/almworks/dyoma/kubenetes/logs/server/server.properties)
 * Choose PODs you want to load logs from:
    ```kotlin
    client.listPods("default")
    //.filter { it.name == "front-0" } // Uncomment to choose PODs you want to load logs from
      .forEach(extractor::loadLogs)
    ```
Run `RunServer.kt` and find the loaded logs at: http://localhost:8123/api/events?sid=0    
### Prepare the Web App
* If you changed server port from default (8123) you need to update [index.tsx](logs-viewer/src/ui/index.tsx)
* In terminal `cd` to [logs-viewer](logs-viewer)
* Run `npm install`
* Run `npm run build`. Other options are: `build-dev` and `build-watch`
* Open in Idea [index.html](logs-viewer/dist/index.html) and open it in your favorite browser (I tested with Firefox)
* Remove the query of the `index.html` URL, otherwise the page automatically reloads on any change. 
## Know Problems
* **Server.** All logs loaded from the cluster remains in JVM heap forever. So, the server consumes more memory than needed.
* **Web.** The `All` tab is unusable and renders too many log records