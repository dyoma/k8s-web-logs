import * as React from "react";
import {createRoot} from 'react-dom/client';
import {EventLoader} from "./eventLoader";
import {EventListComponent} from "./events";
import {TabbedPane} from "./tabs";
import {GroupByExceptionClass} from "./exceptionGroups";
import "./scroll.css"

const SERVER = "http://localhost:8123/api"

function LogsApp() {
  const allEvents = EventLoader.useAllEvents();
  const allEventsState = allEvents.useSnapshot();
  return <>
    <h3>Events loaded: {allEventsState.length}</h3>
    <TabbedPane tabs={[
      {
        name: "Exceptions",
        comp: <GroupByExceptionClass events={allEvents}/>,
        permanent: true,
        keepDOM: "STD:Exceptions"
      },
      {
        name: "Temp",
        comp: <h3>Hello!</h3>
      },
      {
        name: "All",
        comp: <EventListComponent events={allEventsState}/>,
        permanent: true
      }]}/>
  </>
}

export function initReactApp() {
  const container = document.getElementById('reactRoot');
  const root = createRoot(container!!);
  root.render(<EventLoader apiUri={SERVER}><LogsApp/></EventLoader>);
}
