import * as React from "react";
import {DisplayOptions} from "../commons/components";
import {EventLoader} from "../commons/eventLoader";
import {TabbedPane} from "../commons/tabs";
import {LEvent} from "../../data/loadEvents";
import {EventListComponent} from "../commons/events";

type RefType = {
  tabIdPrefix: string,
  dataField: string,
  displayOption: keyof DisplayOptions
}

const TRACE_ID: RefType = {
  tabIdPrefix: "TR",
  dataField: "traceId",
  displayOption: "trace"
}

const SPAN_ID: RefType = {
  tabIdPrefix: "SP",
  dataField: "spanId",
  displayOption: "span"
}

export function TraceLink(props: {event: LEvent}) {
  return <RefLink event={props.event} type={TRACE_ID}/>
}

export function SpanIdLink(props: {event: LEvent}) {
  return <RefLink event={props.event} type={SPAN_ID}/>
}

function RefLink(props: {event: LEvent, type: RefType}) {
  const type = props.type;
  const options = DisplayOptions.use();

  if (!options[type.displayOption]) return <></>
  const refValue = props.event.data[type.dataField]
  if (!refValue) return <></>
  const shorten = refValue.length > 4 ? refValue.substring(refValue.length - 4) : refValue
  const tabController = TabbedPane.use();
  function onClick(e: React.MouseEvent) {
    e.preventDefault()
    addOrSelectRefValueTab(tabController, refValue, type)
  }
  return <a className="mr2 ui-events-trace-link" href="#" onClick={onClick}>{type.tabIdPrefix}-{shorten}</a>
}

function RefValueTab(props: {refValue: string, type: RefType}) {
  const type = props.type;
  const options = DisplayOptions.use()
  const displayNoRef = type.displayOption ? {...options, [type.displayOption]: false} : options
  const filter = React.useMemo(() => (e: LEvent) => e.data[type.dataField] === props.refValue, [props.refValue]);
  const events = EventLoader.useAllEvents()
      .useFilter(filter, LEvent.RECENT_FIRST_COMPARATOR)
  events.debugName = `${type.tabIdPrefix}[${props.refValue}]`
  const snapshot = events.useSnapshot();

  return <DisplayOptions.Context.Provider value={displayNoRef}>
    <EventListComponent events={snapshot}/>
  </DisplayOptions.Context.Provider>
}

function addOrSelectRefValueTab(controller: TabbedPane.Controller, refValue: string, type: RefType) {
  const tabId = `${type.tabIdPrefix}:${refValue}`
  const index = controller.tabs.findIndex(tab => tab.userData?.tabId === tabId);
  if (index >= 0) controller.selectTab(index)
  else controller.addAndSelect({
    name: tabId,
    comp: <RefValueTab refValue={refValue} type={type}/>,
    userData: {
      tabId: tabId
    },
    keepDOM: tabId
  })
}
