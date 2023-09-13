import * as React from "react";
import {GroupByOperation, ObservableSet} from "../commons/operations";
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

class ByValueSetFilter {
  private constructor(private readonly selectionAndSetter: ValueAndSetter<Set<string>>,
                      readonly grouper: (e: LEvent) => string,
                      readonly groups: GroupByOperation<LEvent, string>) {}

  static use(events: ObservableSet<LEvent>, grouper: (e: LEvent) => string): ByValueSetFilter {
    const groups = events.useGroupByText(grouper)
    groups.debugName = "byValue-" + grouper.name

    const selectionAndSetter = React.useState(new Set<string>())
    return new ByValueSetFilter(selectionAndSetter, grouper, groups)
  }

  get selection(): Set<string> { return this.selectionAndSetter[0] }

  isAccepted(event: LEvent) {
    return this.selection.size == 0 || this.selection.has(this.grouper(event))
  }

  component(comparator?: Comparator<string>) {
    return <Groups events={this.groups} selection={this.selectionAndSetter} groupOrder={comparator}/>
  }
}

function useFilterByText(events: ObservableSet<LEvent>): [ObservableSet<LEvent>, React.JSX.Element] {
  const [text, setText] = React.useState("");
  const filter = React.useMemo(() => {
    return (e: LEvent) => {
      return !text || e.data.message.indexOf(text) >= 0
    }
  }, [text]);
  return [
    events.useFilter(filter, LEvent.RECENT_FIRST_COMPARATOR),
    <input type="text" placeholder="Search for substring in messages" value={text}
           onChange={e => setText(e.target.value)}/>
  ]
}

function getLogLevel(event: LEvent) { return event.data.level }
function getPodName(event: LEvent) { return event.pod.name }

export function AllEvents() {
  const displayableFilter = React.useContext(DisplayableEvents);
  const events = EventLoader.useAllEvents()
      .useFilter(displayableFilter)

  const byPodName = ByValueSetFilter.use(events, getPodName)
  const byLogLevel = ByValueSetFilter.use(events, getLogLevel);

  const byGroupsFilter = React.useMemo(() => {
    return (e: LEvent) => byLogLevel.isAccepted(e) && byPodName.isAccepted(e);
  }, [byLogLevel.selection, byPodName.selection]);

  const filterPodsAndLevels = events.useFilter(byGroupsFilter)
  filterPodsAndLevels.debugName = "FilteredByLevel+Group"

  const [filtered, filterByTextComp] = useFilterByText(filterPodsAndLevels);
  const snapshot = filtered.useSnapshot();

  return <div className="ui-scroll-ancestor">
    <div className="ui-gr-option-pane">Levels: {byLogLevel.component()} </div>
    <div className="ui-gr-option-pane">PODs: {byPodName.component(Comparator.NATURAL)}</div>
    <div className="ui-gr-text-search">
      <span className="mr2">Filter by Text:</span>
      { filterByTextComp }
    </div>
    <div className="ui-gr-bottom"/>
    <EventListComponent events={snapshot.sublist(0, 200)}/>
  </div>
}