import * as React from "react";
import {ReactNode} from "react";
import {List} from "../../utils/collections";
import "./components.css"

export type ValueAndSetter<T> = [T, (setter: (prev: T) => T) => void]

export type DisplayOptions = {
  trace: boolean,
  time: boolean,
  pod: boolean,
  isException: boolean
}

export namespace DisplayOptions {
  export const Context = React.createContext<DisplayOptions>({
    trace: true,
    time: true,
    pod: true,
    isException: true
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

function isEmpty(value: any) {
  if (!value) return true
  return typeof value === "string" && !value.trim();

}
export function FieldValue(props: {label: String, value?: String | number, displayInline?: boolean, valueClass?: string, children?: ReactNode | ReactNode[]}) {
  const value = typeof props.value === "object" ? JSON.stringify(props.value) : props.value;
  const children = props.children;
  if (isEmpty(value) && (!children || (Array.isArray(children) && children.length === 0))) return null
  const content = <>
    <span className="ui-comp-label">{props.label}:</span>
    {value ? <span className={props.valueClass || ""}>{value}</span> : null}
    {children}
  </>
  if (props.displayInline) return content
  return <div className="mr3">
    {content}
  </div>
}