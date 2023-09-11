import * as React from "react";
import {EventGroups, FilterOperation, ObservableEventList} from "./operations";
import {LogException} from "../data/exception";
import {List} from "../utils/collections";
import {LEvent} from "../data/loadEvents";
import {ExpandableComponent, ListComponent} from "./components";
import {EventListComponent} from "./events";

class Group {
  constructor(readonly className: string, readonly events: List<LEvent>) {
  }

  static getClassName(g: Group) {
    return g.className
  }

  static render(group: Group) {
    return <ExpandableComponent
        header={<><span className="mr2">{group.className}:</span><span>{group.events.length}</span></>}
        body={
          <div className="ui-comp-treeOffset">
            <EventListComponent events={group.events}/>
          </div>}
    />
  }
}

export function GroupByExceptionClass(props: {events: ObservableEventList}) {
  const exceptions = FilterOperation.useFilter(props.events, e => e.data.stack_trace, "Exceptions");
  const byExClass = EventGroups.useTextGrouper(exceptions, e => LogException.parseStackTrace(e.data.stack_trace).exClass, "ExByClass");
  const byExClassSnapshot = byExClass.useSnapshot();
  const sortedByClass = byExClassSnapshot.toKeyValueArray(v => v.length > 0)
      .map(pair => new Group(pair[0], pair[1]))
      .sortBy(group => group.className);

  return <ListComponent list={new List(sortedByClass)} getKey={Group.getClassName} renderer={Group.render}/>
}

