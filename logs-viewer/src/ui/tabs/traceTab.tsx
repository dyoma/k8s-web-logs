import * as React from "react";
import {DisplayOptions} from "../commons/components";
import {EventLoader} from "../commons/eventLoader";
import {TabbedPane} from "../commons/tabs";
import {LEvent} from "../../data/loadEvents";
import {EventListComponent} from "../commons/events";

export function TraceLink(props: {event: LEvent}) {
  const traceId = props.event.data.traceId;
  if (!traceId) return <></>
  const shorten = traceId.length > 4 ? traceId.substring(traceId.length - 4) : traceId
  const tabController = TabbedPane.use();
  function onClick(e: React.MouseEvent) {
    e.preventDefault()
    addOrSelectTraceTab(tabController, traceId)
  }
  return <a className="mr2 ui-events-trace-link" href="#" onClick={onClick}>tr-{shorten}</a>
}

function TraceTab(props: {traceId: string}) {
  const options = DisplayOptions.use()
  const displayNoTrace = {...options, trace: false}
  const traceEvents = EventLoader.useAllEvents()
      .useFilter(e => e.data.traceId === props.traceId)
  traceEvents.debugName = `TraceId[${props.traceId}]`
  const traceSnapshot = traceEvents.useSnapshot();

  return <DisplayOptions.Context.Provider value={displayNoTrace}>
    <EventListComponent events={traceSnapshot}/>
  </DisplayOptions.Context.Provider>
}

function addOrSelectTraceTab(controller: TabbedPane.Controller, traceId: string) {
  const index = controller.tabs.findIndex(tab => tab.userData?.traceId === traceId);
  if (index >= 0) controller.selectTab(index)
  else controller.addAndSelect({
    name: `TR:${traceId}`,
    comp: <TraceTab traceId={traceId}/>,
    userData: {
      traceId: traceId
    },
    keepDOM: "TRACE:" + traceId
  })
}
