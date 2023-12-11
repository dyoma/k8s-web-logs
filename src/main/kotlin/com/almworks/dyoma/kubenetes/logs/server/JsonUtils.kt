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
    val name = currentName()
    nextToken() // Move to value before reading
    valueReader(name, this)
  }
}

data class JsonField<T : Any>(val name: String, val type: IJsonFieldType<T>) {
  fun fromMap(map: Map<String, Any>) = type.cast(map[name])
    ?: throw IllegalArgumentException("Missing field '$name' in pod info")

  fun write(gen: JsonGenerator, value: T) = type.write(gen, name, value)

  companion object {
    fun toObjSchema(vararg fields: JsonField<*>) = fields.associateBy { it.name }
  }
}

interface IJsonFieldType<T: Any> {
  fun read(parser: JsonParser): T
  fun write(gen: JsonGenerator, name: String, value: T)
  fun cast(value: Any?): T?
}

abstract class JsonFieldType<T: Any>(private val klass: KClass<T>): IJsonFieldType<T> {

  abstract override fun read(parser: JsonParser): T

  override fun cast(value: Any?): T? {
    if (value == null) return null
    if (klass.isInstance(value)) return klass.cast(value)
    else throw IllegalArgumentException("Expected ${klass.java.name} but got ${value.javaClass.name}")
  }

  abstract override fun write(gen: JsonGenerator, name: String, value: T)

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
    val MAP = object : IJsonFieldType<Map<String, Any>> {
      override fun read(parser: JsonParser): Map<String, Any> {
        val data = mutableMapOf<String, Any>()
        parser.readObjectFields { fieldName, p ->
          when (p.currentToken) {
            JsonToken.VALUE_STRING -> data[fieldName] = p.text
            JsonToken.VALUE_NUMBER_INT -> data[fieldName] = p.longValue
            JsonToken.VALUE_NUMBER_FLOAT -> data[fieldName] = p.doubleValue
            JsonToken.VALUE_TRUE -> data[fieldName] = true
            JsonToken.VALUE_FALSE -> data[fieldName] = false
            JsonToken.START_OBJECT -> data[fieldName] = read(p)
            else -> throw IllegalArgumentException("Unexpected token ${p.currentToken}")
          }
          data[fieldName] = parser.text
        }
        return data
      }

      override fun write(gen: JsonGenerator, name: String, value: Map<String, Any>) {
        gen.writeObjectField(name, value)
      }

      override fun cast(value: Any?): Map<String, String>? {
        if (value == null) return null
        @Suppress("UNCHECKED_CAST")
        return Map::class.cast(value) as Map<String, String>? ?: throw IllegalArgumentException("Expected Map<String, String> but got ${value.javaClass.name}")
      }
    }

    fun readValues(parser: JsonParser, schema: Map<String, JsonField<*>>): MutableMap<String, Any> {
      val data = mutableMapOf<String, Any>()
      parser.readObjectFields { fieldName, p ->
        val field = schema[fieldName] ?: throw IllegalArgumentException("Unknown field '$fieldName' in ${schema.keys}")
        data[fieldName] = field.type.read(p)
      }
      return data
    }
  }
}
