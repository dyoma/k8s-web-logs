export class LogException {
  constructor(
      readonly prefix: string,
      readonly exClass: string,
      readonly message: string,
      readonly trace: string
  ) {}

  get traceTrimmed() {
    return (this.trace as String).replace(new RegExp("\n\t", "g"), "\n").trim()
  }

  get wholeExceptionTrimmed() {
    const prefix = this.prefix ? this.prefix + " " : ""
    return `${prefix}${this.exClass}: ${this.message}\n${this.traceTrimmed}`
  }

  static parseStackTrace(stackTrace: string): LogException {
    const stackTraceStart = stackTrace.indexOf("\n\tat ");
    let head: string;
    let trace: string;
    if (stackTraceStart >= 0) {
      head = stackTrace.substring(0, stackTraceStart);
      trace = stackTrace.substring(stackTraceStart);
    } else {
      head = stackTrace
      trace = ""
    }

    const [prefix, cls, message] = this.parseHead(head)
    return new LogException(prefix, cls, message, trace)
  }

  static tryParseStackTrace(stackTrace: string | undefined): LogException | null {
    return stackTrace ? this.parseStackTrace(stackTrace) : null
  }

  private static parseHead(head: String): [string, string, string] {
    let prefix = ""
    if (head.startsWith("<")) {
      const pos = head.indexOf(">")
      if (pos < 0) throw Error(`Wrong head: '${head}'`)
      prefix = head.substring(0, pos + 1)
      head = head.substring(pos + 1);
    }
    const endOfClass = head.indexOf(':')
    if (endOfClass < 0) throw Error(`Wrong head: '${head}'`)
    const className = head.substring(0, endOfClass).trim()
    const message = head.substring(endOfClass + 1).trim()
    return [prefix, className, message]
  }
}