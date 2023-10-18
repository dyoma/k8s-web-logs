package com.almworks.dyoma.kubenetes.logs.server

import com.fasterxml.jackson.core.*
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.KotlinFeature
import com.fasterxml.jackson.module.kotlin.kotlinModule
import java.time.Instant
import kotlin.reflect.KClass
import kotlin.reflect.cast

fun createObjectMapper(): ObjectMapper = ObjectMapper()
  .registerModule(JavaTimeModule())
  .registerModule(kotlinModule { enable(KotlinFeature.SingletonSupport) })

fun JsonGenerator.composeObject(block: JsonGenerator.() -> Unit) {
  writeStartObject()
  block()
  writeEndObject()
}

fun JsonParser.expectToken(token: JsonToken) {
  if (currentToken() != token) throw IllegalStateException("Expected $token")
}

fun JsonParser.readObjectFields(valueReader: (name: String, parser: JsonParser) -> Unit) {
  expectToken(JsonToken.START_OBJECT)
  while (nextToken() != JsonToken.END_OBJECT) {
    val name = nextFieldName()
    valueReader(name, this)
  }
}

data class JsonField<T : Any>(val name: String, val type: JsonFieldType<T>) {
  fun fromMap(map: Map<String, Any>) = type.cast(map[name])
    ?: throw IllegalArgumentException("Missing field '$name' in pod info")

  fun write(gen: JsonGenerator, value: T) = type.write(gen, name, value)

  companion object {
    fun toObjSchema(vararg fields: JsonField<*>) = fields.associateBy { it.name }
  }
}

abstract class JsonFieldType<T: Any>(private val klass: KClass<T>) {
  abstract fun read(parser: JsonParser): T

  fun cast(value: Any?): T? {
    if (value == null) return null
    if (klass.isInstance(value)) return klass.cast(value)
    else throw IllegalArgumentException("Expected ${klass.java.name} but got ${value.javaClass.name}")
  }

  abstract fun write(gen: JsonGenerator, name: String, value: T)

  companion object {
    val STRING = object : JsonFieldType<String>(String::class) {
      override fun read(parser: JsonParser): String = parser.text
      override fun write(gen: JsonGenerator, name: String, value: String) = gen.writeStringField(name, value)
    }
    val LONG = object : JsonFieldType<Long>(Long::class) {
      override fun read(parser: JsonParser): Long = parser.longValue
      override fun write(gen: JsonGenerator, name: String, value: Long) = gen.writeNumberField(name, value)
    }
    val INT = object : JsonFieldType<Int>(Int::class) {
      override fun read(parser: JsonParser): Int = parser.intValue
      override fun write(gen: JsonGenerator, name: String, value: Int) = gen.writeNumberField(name, value)
    }
    val INSTANT_LONG = object : JsonFieldType<Instant>(Instant::class) {
      override fun read(parser: JsonParser): Instant = Instant.ofEpochMilli(parser.longValue)
      override fun write(gen: JsonGenerator, name: String, value: Instant) = gen.writeNumberField(name, value.toEpochMilli())
    }

    fun readValues(parser: JsonParser, schema: Map<String, JsonField<*>>): MutableMap<String, Any> {
      val data = mutableMapOf<String, Any>()
      parser.readObjectFields { fieldName, p ->
        val field = schema[fieldName] ?: throw IllegalArgumentException("Unknown field '$fieldName' in pod info")
        data[fieldName] = field.type.read(p)
      }
      return data
    }

    inline fun <reified T: Any> obj(vararg fields: JsonField<*>, crossinline factory: (map: Map<String, Any>) -> T) = object : JsonFieldType<T>(T::class) {
      private val schema = JsonField.toObjSchema(*fields)
      override fun read(parser: JsonParser): T {
        val data = readValues(parser, schema)
        return factory(data)
      }

      override fun write(gen: JsonGenerator, name: String, value: T) {
        gen.writeObjectField(name, value)
      }
    }
  }
}
