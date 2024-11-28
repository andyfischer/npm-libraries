
# react-elements #

Helper components for using atomic CSS with React.

These components allow you to directly add CSS class names onto the React element.

Works great with Tailwind CSS. An alternative to using the `classnames` library.

### Quick Example ###

Sample code:

    import { Span } from '@andyfischer/react-elements'

    return (
      <Span m-1 p-1 flex border rounded-sm>...</Span>
    )

Renders HTML that looks like:

    <span class="m-1 p-1 flex border rounded-sm">...</span>

# API #

### Element wrappers ###

Each of these components produces an HTML element of the same name.

Any added props will be transformed into the `style` and `class` HTML attribues. See below for the transformation rules.

| component | renders to HTML |
| --------- | --------------- |
| `<Button {...props}>` | `<button ...>`         |
| `<Div {...props}>` | `<div ...>`         |
| `<Form {...props}>` | `<form ...>`         |
| `<Img {...props}>` | `<img ...>`         |
| `<Input {...props}>` | `<input ...>`         |
| `<Pre {...props}>` | `<pre ...>`         |
| `<Span {...props}>` | `<span ...>`         |
| `<Select {...props}>` | `<select ...>`         |

### Block ###

Additionally, this library has an component called `<Block>` which produces a `<div>`.
This is based on a opinion that "div" is a bad name and the name "block" is better.

### Style ###

Another export is called `<Style/>`. This component wraps around its child element and
transforms it.

Useful if you want to apply the same `react-elements` styling rules onto a child element.

Example:

    import { Style } from '@andyfischer/react-elements'

    <Style bg-slate-200>
      <table>
        ...
      </table>
    </Style>

Renders HTML that looks like:

    <table class="bg-slate-200">
      ...
    </table>

# Prop transformation logic #

The logic for handing props on a `react-element` tries to be as unsurprising as possible.

The logic is:

 1) If the prop's value is non-boolean, then preserve the property onto the underlying component.

Example:

    <Img src="url" />

The `src` has a string value so it's preserved:

    <img src="url" />

 2) If the prop's value is `true` then add it onto the CSS `class` (with some special cases below).

Example:

    <Span p-1 m-1 />

Renders to:

    <span class="p-1 m-1" />

 3) If the prop's value is `false` then ignore it. This can help implement CSS classes that are conditional.

Example:

    <Span selected={false} />

Renders to:

    <span />

## Special Cases ##

Below are various special cases to the above logic. These are for props which don't directly map to a CSS class name.

#### 'className' ####

If a `className` value is provided then it's concatenated with CSS classes that come from other props.

Example:

    <Block m-1 className="selected" />

Renders to:

    <Block className="m-1 selected" />

#### 'disabled' ####

The `disabled` prop is passed directly onto the element.

Example:

    <Button m-1 disabled />

Renders to:

    <button className="m-1" disabled />

#### Props that map into the style={} section ####

For props listed below, these are passed into the element's `style` object (if they have a non-boolean value).

Includes:

| prop name |
| --------- |
| `grid` |
| `gridArea` |
| `gridColumn` |
| `gridRow` |
| `flex` |

Example:

    <Block gridArea="1 / 2" />

Renders to:

    <div style={{ gridArea: "1 / 2 "}} 

#### Special prop: 'grid' ####

If the `grid` prop has a value, then it's copied into the `style` object, AND the element's style is also set to `display: grid`.
(matching the `grid` class from Tailwind).

Example:

    <Block grid="repeat(2, 60px) / auto-flow 80px" />

Renders to:

    <div style={{ display: 'grid', grid: 'repeat(2, 60px) / auto-flow 80px' }} />

#### Props that start with `var--` ####

If the prop name starts with `var--` then it's treated as a CSS variable and added into the element's `style`.

Example:

    <Block var--color="#fff">

Renders to:
    <div style={{'--color': '#fff'}} />

