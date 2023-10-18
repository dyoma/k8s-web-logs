package com.almworks.dyoma.kubenetes.logs.server

import com.almworks.dyoma.kubenetes.logs.server.db.DbManager
import com.almworks.dyoma.kubenetes.logs.server.db.EventSearch
import com.sun.net.httpserver.*
import org.slf4j.LoggerFactory
import java.io.File
import java.net.*
import java.time.Instant
import java.util.*


class Server(val db: DbManager, val port: Int, val server: HttpServer) {
  val url get() = "http://localhost:$port/"

  companion object {
    private val log = LoggerFactory.getLogger(Server::class.java)

    fun start(port: Int, db: DbManager): Server {
      val server = HttpServer.create(InetSocketAddress(port), 0)
      server.createContext("/api/events", EventsHandler(db))
      server.executor = null // creates a default executor
      server.start()
      return Server(db, port, server).also {
        println("Server at: ${it.url}")
        println("Share your server over internet (run in terminal): ngrok http ${it.port}")
      }
    }

    fun startDefault(): Server {
      val properties = Properties()
        .also { properties ->
          Server::class.java.getResourceAsStream("server.properties")!!.use { properties.load(it.reader()) }
        }
      val port = Integer.parseInt(properties.getProperty("server.port"))
      val server = start(port, DbManager(File(properties.getProperty("db.path"))))
      properties.getProperty("staticContent.path")?.let { path ->
        val staticDir = File(path)
        staticDir.listFiles()?.forEach { file ->
          if (file.isDirectory) {
            server.addStaticContentHandler(file, "/${file.name}/")
          } else {
            server.addStaticContentHandler(file, "/${file.name}")
          }
        }
        File(staticDir, "index.html").takeIf { it.exists() }?.let { server.addStaticContentHandler(it, "/") }
      }
      return server
    }
  }

  fun addStaticContentHandler(file: File, path: String) {
    log.info("Adding static content handler for $path")
    server.createContext(path, StaticContentHandler(path, file))
  }

  private class StaticContentHandler(private val pathPrefix: String, private val root: File) : HttpHandler {
    override fun handle(exchange: HttpExchange) {
      val path = exchange.requestURI.path.substringAfter(pathPrefix)
      val file = File(root, path)
      if (!file.exists()) {
        exchange.sendResponseHeaders(404, 0)
        exchange.responseBody.use { it.write("Not found: $path".toByteArray()) }
        return
      }
      exchange.sendResponseHeaders(200, file.length())
      exchange.responseBody.use { file.inputStream().copyTo(it) }
    }
  }

  private class EventsHandler(private val db: DbManager) : HttpHandler {
    private data class GetEventsParams(val sid: Long?, val time: Instant?) {
      companion object {
        fun fromUri(uri: URI): GetEventsParams {
          val params = splitQuery(uri)
          return GetEventsParams(
            getLongParam(params, "sid"),
            getLongParam(params, "time")?.let(Instant::ofEpochMilli))
        }
      }
    }
    override fun handle(exchange: HttpExchange) {
      val params = try {
        GetEventsParams.fromUri(exchange.requestURI)
      } catch (e: Exception) {
        val message = e.message!!
        exchange.responseHeaders.add("Content-Type", "text/html; charset=utf-8")
        exchange.sendResponseHeaders(400, message.length.toLong())
        exchange.responseBody.use { it.write(message.toByteArray()) }
        return
      }
      exchange.responseHeaders.add("Content-Type", "application/json; charset=utf-8")
      exchange.responseHeaders.add("Access-Control-Allow-Origin", "*")
      exchange.sendResponseHeaders(200, 0)
      exchange.responseBody.use { stream ->
        EventSender.toStream(stream) { db.searchEvent(EventSearch(params.sid, params.time), it::send) } }
    }
  }
}

private fun getLongParam(params: Map<String, String>, name: String): Long? =
  params[name]?.let(java.lang.Long::parseLong)

private fun splitQuery(url: URI): Map<String, String> {
  val params: MutableMap<String, String> = LinkedHashMap()
  val query: String = url.query
  val pairs = query.split("&".toRegex()).dropLastWhile { it.isEmpty() }.toTypedArray()
  for (pair in pairs) {
    val idx = pair.indexOf("=")
    params[URLDecoder.decode(pair.substring(0, idx), "UTF-8")] =
      URLDecoder.decode(pair.substring(idx + 1), "UTF-8")
  }
  return params
}
