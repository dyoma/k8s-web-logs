import * as React from "react";
import {LogException} from "../../data/exception";
import {List} from "../../utils/collections";
import {LEvent} from "../../data/loadEvents";
import {ExpandableComponent, ListComponent} from "../commons/components";
import {DisplayableEvents, EventListComponent} from "../commons/events";
import {EventLoader} from "../commons/eventLoader";

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

function getExceptionClass(event: LEvent) {
  return LogException.parseStackTrace(event.data.stack_trace).exClass
}

function hasStackTrace(event: LEvent): boolean {
  return !!event.data.stack_trace
}

export function GroupByExceptionClass() {
  const displayableFilter = React.useContext(DisplayableEvents);
  const events = EventLoader.useAllEvents()
      .useFilter(displayableFilter)
  const exceptions = events.useFilter(hasStackTrace)
  exceptions.debugName = "Exceptions"

  const byExClass = exceptions.useGroupByText(
      getExceptionClass,
      LEvent.RECENT_FIRST_COMPARATOR);
  byExClass.debugName = "ExByClass"

  const byExClassSnapshot = byExClass.useSnapshot();

  const sortedByClass = byExClassSnapshot.toKeyValueArray(v => v.length > 0)
      .map(pair => new Group(pair[0], pair[1]))
      .sortBy(group => group.className);

  return <ListComponent list={new List(sortedByClass)} getKey={Group.getClassName} renderer={Group.render}/>
}

