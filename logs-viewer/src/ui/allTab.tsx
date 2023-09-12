import * as React from "react";
import {GroupByOperation, ObservableSet} from "./operations";
import {LEvent} from "../data/loadEvents";
import {Comparator} from "../utils/collections";
import {EventListComponent} from "./events";
import "./allTab.css"

type ValueAndSetter<T> = [T, (setter: (prev: T) => T) => void]
type GroupsProps = {
  events: GroupByOperation<LEvent, string>,
  groupOrder?: Comparator<string>,
  selection: ValueAndSetter<Set<string>>
}
function Groups(props: GroupsProps) {
  const groups = props.events
      .useSnapshot()
      .toKeyValueArray(list => list.length > 0)
  if (props.groupOrder) groups.sort(Comparator.byKey(p => p[0], props.groupOrder))

  function toggle(e: React.MouseEvent, value: string) {
    e.stopPropagation()
    props.selection[1](prev => {
      const upd = new Set(prev)
      if (prev.has(value)) upd.delete(value)
      else upd.add(value)
      return upd
    })
  }
  return <>
    {groups.map(p => {
      const name = p[0]
      const groupedEvents = p[1]
      const active = props.selection[0].has(name) ? " ui-gr-active" : ""
      return <span key={name}
                   onClick={e => toggle(e, name)}
                   className={"mr2 mb2 ui-gr-option" + active}>
        {name}: {groupedEvents.length}
      </span>
    }) }
  </>
}

export function AllEvents(props: {events: ObservableSet<LEvent>}) {
  const byLogLevel = props.events.useGroupByText(e => e.data.level)
  byLogLevel.debugName = "byLogLevel"
  const byPodName = props.events.useGroupByText(e => e.pod.name)
  byPodName.debugName = "byPodName"

  const levels = React.useState(new Set<string>())
  const pods = React.useState(new Set<string>())
  const filterLevels = levels[0]
  const filterPods = pods[0]
  const byGroupsFilter = React.useMemo(() => {
    console.log("New filter")
    return (e: LEvent) => {
      const pod = e.pod.name;
      const level = e.data.level;
      if (filterLevels.size > 0 && !filterLevels.has(level)) return false
      // noinspection RedundantIfStatementJS
      if (filterPods.size > 0 && !filterPods.has(pod)) return false
      return true
    }
  }, [filterLevels, filterPods]);

  const filtered = props.events.useFilter(byGroupsFilter)
  filtered.debugName = "FilteredByLevel+Group"
  const snapshot = filtered.useSnapshot();
  return <div className="ui-scroll-ancestor">
    <div className="ui-gr-option-pane">Levels:<Groups events={byLogLevel} selection={levels}/></div>
    <div className="ui-gr-option-pane">PODs:<Groups events={byPodName} selection={pods} groupOrder={Comparator.natural()}/></div>
    <div className="ui-gr-bottom"/>
    <EventListComponent events={snapshot.sublist(0, 200)}/>
  </div>
}