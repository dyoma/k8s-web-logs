import * as React from "react";
import {createRoot} from 'react-dom/client';
import {EventLoader} from "./commons/eventLoader";
import {TabbedPane} from "./commons/tabs";
import {GroupByExceptionClass} from "./tabs/exceptionGroups";
import "./commons/scroll.css"
import {AllEvents} from "./tabs/allTab";
import {ValueAndSetter} from "./commons/components";
import {LEvent} from "../data/loadEvents";
import {DisplayableEvents} from "./commons/events";

const SERVER = "/api"

function DisplayAfter(props: {start: ValueAndSetter<Date | null>}) {
  const [text, setText] = React.useState<string>(props.start[0]?.toISOString() || "")
  function setCurrent() {
    const date = new Date(text);
    if (isNaN(date.getTime())) return
    props.start[1](() => date)
  }
  function setStart(time: Date | null) {
    if (!time) setText("")
    else setText(time.toISOString())
    props.start[1](() => time)
  }
  return <span className="mr3">
    <span className="mr2">Display After:</span>
    <input className="mr2" type="text" value={text} onChange={e => setText(e.target.value)}/>
    <span className="ui-comp-control-long mr2" onClick={() => setCurrent()}>Set</span>
    <span className="ui-comp-control-long mr2" onClick={() => setStart(new Date())}>Now</span>
    <span className="ui-comp-control-long mr2" onClick={() => setStart(null)}>Reset</span>
  </span>
}

function LogsApp() {
  const allEvents = EventLoader.useAllEvents();
  const allEventsState = allEvents.useSnapshot();
  const start: ValueAndSetter<Date | null> = React.useState<Date | null>(null)
  const showAfter = start[0];
  const filterAfter = React.useMemo(() => {
    const filter = (e: LEvent) => {
      if (!showAfter) return true
      return e.time.getTime() >= showAfter.getTime()
    };
    filter.debugName = "After: " + showAfter?.toISOString()
    return filter
  }, [showAfter]);
  const displayEvents = allEvents.useFilter(filterAfter);
  const displayEventsState = displayEvents.useSnapshot();
  return <DisplayableEvents.Provider value={filterAfter}>
    <div>
      <span className="mr3">Loaded: {allEventsState.length}</span>
      <DisplayAfter start={start}/>
      <span>Displayable: {displayEventsState.length}</span>
    </div>
    <TabbedPane tabs={[
      {
        name: "Exceptions",
        comp: <GroupByExceptionClass/>,
        permanent: true,
        keepDOM: "STD:Exceptions"
      },
      {
        name: "All",
        comp: <AllEvents/>,
        permanent: true,
        keepDOM: "STD:All"
      }]}/>
  </DisplayableEvents.Provider>
}

export function initReactApp() {
  const container = document.getElementById('reactRoot');
  const root = createRoot(container!!);
  root.render(<EventLoader apiUri={SERVER} pingMillis={500}><LogsApp/></EventLoader>);
}
