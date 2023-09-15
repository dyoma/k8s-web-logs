import * as React from "react";
import {LEvent} from "../../data/loadEvents";
import {List} from "../../utils/collections";
import {DisplayOptions, FieldValue, ListComponent, ShortLongDetailsComponent} from "./components";
import "./events.css"
import {LogException} from "../../data/exception";
import {TraceLink} from "../tabs/traceTab";

function showAll() { return true }
export const DisplayableEvents = React.createContext<(e: LEvent) => boolean>(showAll)

function eventLineRenderer(event: LEvent) {
  return <div className="mc-eventLineRenderer">
    <ShortLongDetailsComponent
        header={<EventInfoLine event={event}/>}
        body={<EventDetails event={event}/>}
    />
  </div>
}

function getEventSid(event: LEvent) { return event.sid }

export function EventListComponent(props: {events: List<LEvent>}) {
  return <ListComponent list={props.events} renderer={eventLineRenderer} getKey={getEventSid}></ListComponent>
}

export function EventInfoLine(props: {event: LEvent}) {
  const options = DisplayOptions.use()
  return <div className="ui-comp-wrap-text ui-comp-limit-text-height">
    {options.trace && props.event.data.traceId ? <TraceLink event={props.event}/> : null}
    {options.time ? <span className="mr2">{props.event.time.toISOString()}</span>: null }
    {options.pod ? <span className="ui-event-pod mr2">{props.event.pod.name}</span> : null}
    <LogLevel event={props.event}/>
    <span className="mr2">{props.event.data.message}</span>
  </div>
}

const SKIP_EVENT_PROPERTIES = new Set<string>(["domainId", "logger_name", "stack_trace", "traceId", "message"])
export function EventDetails(props: {event: LEvent}) {
  const options = DisplayOptions.use();
  const stackTrace = LogException.tryParseStackTrace(props.event.data.stack_trace);
  return <div className="mc-EventDetails ui-comp-wrap-text ui-event-details-pane">
    <div className="ui-event-message"><LogLevel event={props.event}/>{props.event.data.message}</div>
    <div className="ui-event-extra">
      <div className="flex">
        <FieldValue label="Trace">
          {options.trace && props.event.data.traceId ? <TraceLink event={props.event}/> : null}
        </FieldValue>
        <FieldValue label="Time" value={props.event.time.toISOString()}/>
        <FieldValue label="POD" value={props.event.pod.name}/>
      </div>
      <div style={{display: "flex"}}>
        <FieldValue label="Domain" value={props.event.data.domainId}/>
        <FieldValue label="Logger" value={props.event.data.logger_name}/>
      </div>
      <div>
        { Object.getOwnPropertyNames(props.event.data).map(key => {
          if (SKIP_EVENT_PROPERTIES.has(key)) return null
          return <>
            <FieldValue key={key} label={key} value={props.event.data[key]} displayInline={true} valueClass="ui-event-value-unknown"/>
            <span className="mr2"/>
          </>
        })}
      </div>
    </div>
    {stackTrace ? <pre className="ui-event-stack-trace">{stackTrace.wholeExceptionTrimmed}</pre> : null }
  </div>
}

const LEVEL_TO_CLASS = new Map<string, string>()
LEVEL_TO_CLASS.set("INFO", "ui-event-log-level-info")
LEVEL_TO_CLASS.set("WARN", "ui-event-log-level-warn")
LEVEL_TO_CLASS.set("ERROR", "ui-event-log-level-error")

function LogLevel(props: {event: LEvent}) {
  const options = DisplayOptions.use();
  const level = props.event.data.level;
  const stackTrace = props.event.data.stack_trace;
  const cls = LEVEL_TO_CLASS.get(level) || ""
  return <span className="mr2">
    <span className={"ui-event-log-level " + cls}>{level}</span>
    { options.isException && !!stackTrace ? <span className="ui-event-log-level ui-event-log-level-ex">EX</span> : null }
    </span>
}