package com.almworks.dyoma.kubenetes.logs.server

import com.sun.net.httpserver.*
import java.net.*
import java.time.Instant


class Server {
  companion object {
    fun start(sendEvents: SendEvents, port: Int) {
      val server = HttpServer.create(InetSocketAddress(port), 0)
      println("Server at: http://localhost:$port/")
      server.createContext("/api/events", EventsHandler(sendEvents))
      server.executor = null // creates a default executor
      server.start()
    }
  }

  class EventsHandler(private val sendEvents: SendEvents) : HttpHandler {
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
      sendEvents.send(params.sid, params.time, exchange.responseBody)
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
