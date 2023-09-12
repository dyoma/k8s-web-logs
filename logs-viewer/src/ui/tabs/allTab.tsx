import * as React from "react";
import {GroupByOperation} from "../commons/operations";
import {LEvent} from "../../data/loadEvents";
import {Comparator} from "../../utils/collections";
import {DisplayableEvents, EventListComponent} from "../commons/events";
import "./allTab.css"
import {ValueAndSetter} from "../commons/components";
import {EventLoader} from "../commons/eventLoader";

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

function getLogLevel(event: LEvent) {
  return event.data.level
}

function getPodName(event: LEvent) {
  return event.pod.name
}

export function AllEvents() {
  const displayableFilter = React.useContext(DisplayableEvents);
  const events = EventLoader.useAllEvents()
      .useFilter(displayableFilter)

  const byLogLevel = events.useGroupByText(getLogLevel)
  byLogLevel.debugName = "byLogLevel"
  const byPodName = events.useGroupByText(getPodName)
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

  const filterPodsAndLevels = events.useFilter(byGroupsFilter)
  filterPodsAndLevels.debugName = "FilteredByLevel+Group"

  const [searchText, setSearchText] = React.useState("");
  const textFilter = React.useMemo(() => {
    return (e: LEvent) => {
      return !searchText || e.data.message.indexOf(searchText) >= 0
    }
  }, [searchText]);
  const filterText = filterPodsAndLevels.useFilter(textFilter);

  const snapshot = filterText.useSnapshot();
  return <div className="ui-scroll-ancestor">
    <div className="ui-gr-option-pane">Levels:<Groups events={byLogLevel} selection={levels}/></div>
    <div className="ui-gr-option-pane">PODs:<Groups events={byPodName} selection={pods} groupOrder={Comparator.natural()}/></div>
    <div className="ui-gr-text-search">
      <span className="mr2">Filter by Text:</span>
      <input type="text" placeholder="Search for substring in messages" value={searchText}
             onChange={e => setSearchText(e.target.value)}/>
    </div>
    <div className="ui-gr-bottom"/>
    <EventListComponent events={snapshot.sublist(0, 200)}/>
  </div>
}
