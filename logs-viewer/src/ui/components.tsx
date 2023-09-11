import * as React from "react";
import {ReactNode} from "react";
import {List} from "../utils/collections";
import "./components.css"

export type DisplayOptions = {
  trace: boolean,
  time: boolean,
  pod: boolean
}

export namespace DisplayOptions {
  export const Context = React.createContext<DisplayOptions>({
    trace: true,
    time: true,
    pod: true
  })

  export function use(): DisplayOptions {
    return React.useContext(Context)
  }
}


export function ListComponent<T>(props: {list: List<T>, renderer: (t: T, index: number) => ReactNode, getKey: (t: T) => number | string}) {
  return <div className="ui-comp-list">
    {props.list.mapToArray((t, i) => <div className="ui-comp-list-element" key={props.getKey(t)}>{props.renderer(t, i)}</div>)}
  </div>
}

export function ExpandableComponent(props: {header: React.JSX.Element, body: React.JSX.Element}) {
  const [expanded, setExpanded] = React.useState(false)
  return <div className="mc-ExpandableComponent">
    <span className="ui-comp-control" onClick={() => setExpanded(!expanded)}>{expanded ? "-" : "+"}</span>
    {props.header}
    {expanded ? props.body : null}
  </div>
}

export function ShortLongDetailsComponent(props: {header: React.JSX.Element, body: React.JSX.Element}) {
  const [expanded, setExpanded] = React.useState(false)
  return <div className="flex mc-ShortLongDetailsComponent">
    <div className="ui-comp-control" onClick={() => setExpanded(!expanded)}>{expanded ? "-" : "+"}</div>
    <div className="flex-grow">{ expanded ? props.body : props.header }</div>
  </div>
}


export function FieldValue(props: {label: String, value?: String, children?: ReactNode | ReactNode[]}) {
  const value = props.value;
  const children = props.children;
  if ((!value || !value.trim()) && (!children || (Array.isArray(children) && children.length === 0))) return null
  return <div className="mr3">
    <span className="ui-comp-label">{props.label}:</span>
    {value ? <span>{value}</span> : null}
    {children}
  </div>
}