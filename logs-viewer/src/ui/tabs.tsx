import * as React from "react";
import "./tabs.css"
import {List} from "../utils/collections";

type TabsState = {
  tabs: TabbedPane.Tab[],
  selected: number
}

export function TabbedPane(props: {tabs: TabbedPane.Tab[], selected?: number}) {
  const [state, setState] = React.useState<TabsState>({tabs: props.tabs, selected: props.selected || 0});
  const [controller, currentStateArr] = React.useMemo(() => {
    const arr: [TabsState] = [null!!]
    const controller = new TabbedPane.Controller(setState, arr);
    return [controller, arr]
  } , []);
  currentStateArr[0] = state
  const selectedTab = state.tabs[state.selected]
  function onCloseClick(e: React.MouseEvent, tab: TabbedPane.Tab) {
    e.stopPropagation()
    controller.closeTab(tab)
  }
  let renderTabs = state.tabs.filter(tab => tab.keepDOM || tab === selectedTab);
  return <Context.Provider value={controller}>
    <div className="ui-tabs-pane">
      {state.tabs.map((t, i) =>
          <div className={"ui-tabs-tab" + (i == state.selected ? " ui-tabs-active" : "")}
                key={i}
                onClick={() => controller.selectTab(i)}>
            <span className="mr2">{t.name}</span>
            {!t.permanent ? <span className="ui-tabs-tab-close" onClick={e => onCloseClick(e, t)}>x</span> : null}

        </div> )}
    </div>
    { renderTabs.map(tab => {
      const key = tab.keepDOM || "###TabbedPane.SelectedTab###"
      const extractClass = tab === selectedTab ? "ui-scroll-ancestor" : "ui-tabs-invisible"
      return <div key={key} className={"cm-TabbedPane " + extractClass}>
        {tab.comp}
      </div>;

    })}
  </Context.Provider>
}

export namespace TabbedPane {
  export type Tab = {
    readonly name: string,
    readonly comp: React.JSX.Element,
    /** When set to `true` the tab has no "x" (close) control. So, it's impossible to close from UI.  */
    readonly permanent?: boolean,
    /**
     * If set must be unique ID, no other tab should reuse it.
     * TabbedPane renders this tab even when it isn't selected. This keeps both React and HTML DOM states.
     * If not set, TabbedPane renders the tab if only it's selected.
     */
    readonly keepDOM?: string,
    readonly userData?: any
  }

  export class Controller {
    constructor(private readonly setTabs: (set: (prev: TabsState) => TabsState) => void,
                private readonly stateHolder: [TabsState]) {}

    selectTab(index: number) {
      this.setTabs((prev) => {
        return {tabs: prev.tabs, selected: index}
      })
    }

    get tabs(): List<Tab> {
      return new List(this.stateHolder[0].tabs)
    }

    addAndSelect(tab: TabbedPane.Tab) {
      this.setTabs(prev => {
        return { tabs: [...prev.tabs, tab], selected: prev.tabs.length}
      })
    }

    closeTab(tab: TabbedPane.Tab) {
      this.setTabs(prev => {
        const index = prev.tabs.indexOf(tab);
        if (index < 0) return prev
        const newTabs = [...prev.tabs]
        newTabs.splice(index, 1)
        let newSelected = prev.selected
        if (newSelected > index) newSelected--
        return {
          tabs: newTabs,
          selected: newSelected
        }
      })
      return undefined;
    }
  }

  export function use(): Controller {
    return React.useContext(Context)
  }
}

const Context = React.createContext(new TabbedPane.Controller(null!!, [null!!]))
