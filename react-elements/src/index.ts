
import { createElement, cloneElement, Children, } from 'react'

const c_passthroughProp = 1;
const c_passthroughObject = 2;
const c_ignore = 3;
const c_styleObject = 4;
const c_className = 7;
const c_styleField = 8;
const c_grid = 9;

const propBehavior: { [name:string]: number } = {
    // React
    key: c_passthroughProp,
    children: c_passthroughProp,
    ref: c_ignore,
    style: c_styleObject,
    passthrough: c_passthroughObject,

    // Common props that can be truthy
    disabled: c_passthroughProp,

    // Class name
    class: c_className,
    className: c_className,

    // Special case: 'grid'
    
    // Style fields
    grid: c_grid,
    gridArea: c_styleField,
    gridColumn: c_styleField,
    gridRow: c_styleField,
    flex: c_styleField,
}

function deriveElementNameAndProps(props: any): [ any, string ] {

    let classNames = [];
    let finalProps: any = {};
    let elementName: string;

    for (let [key, value] of Object.entries(props)) {

        switch (propBehavior[key]) {
        case c_ignore:
            continue;

        case c_className:
            classNames.push(value);
            continue;

        case c_passthroughProp:
            finalProps[key] = value;
            continue;

        case c_passthroughObject:
            finalProps = {
                ...finalProps,
                ...(value as any),
            };
            continue;

        case c_styleObject:
            if (finalProps.style) {
                finalProps.style = {
                    ...finalProps.style,
                    ...(value as any),
                }
            } else {
                finalProps.style = value;
            }
            continue;

        case c_grid:
            if (value) {
                if (value == true) {
                    classNames.push('grid');
                } else {
                    finalProps.style = finalProps.style || {};
                    finalProps.style['grid'] = value;
                    finalProps.style['display'] = 'grid';
                }
            }
            continue;

        case c_styleField:
            if (value) {
                if (value == true) {
                    classNames.push(key);
                } else {
                    finalProps.style = finalProps.style || {};
                    finalProps.style[key] = value;
                }
            }
            continue;
        }

        // Didn't find it in the propBehavior map.

        // Pass var--* through as a CSS variable.
        if (key.indexOf('var--') === 0) {
            // CSS variable
            key = key.replace('var', '');
            finalProps.style = finalProps.style || {};
            finalProps.style[key] = value;
            continue;
        }

        // Check the value - if it's boolean 'true' then treat it as a CSS class name.
        if (value === true) {
            key = key.replace('__', ':');
            classNames.push(key);
            continue;
        }

        // Certain falsy values are ignored
        if (value === false || value === null || value === undefined) {
            continue;
        }

        // Finally: Treat it as a normal prop.
        finalProps[key] = value;
    }

    if (classNames.length > 0)
        finalProps.className = classNames.join(' ');

    return [ finalProps, elementName ];
}

export function getDerivedProps(props: any) {
    const [ finalProps ] = deriveElementNameAndProps(props);
    return finalProps;
}

export function Block(props: any) {
    const [ derivedProps, elementName ] = deriveElementNameAndProps(props);
    return createElement(elementName || 'div', derivedProps);
}

export function Div(props: any) {
    const derivedProps = getDerivedProps(props);
    return createElement('div', derivedProps);
}

export function Span(props: any) {
    const derivedProps = getDerivedProps(props);
    return createElement('span', derivedProps);
}

export function Button(props: any) {
    const derivedProps = getDerivedProps(props);
    return createElement('button', derivedProps);
}

export function Img(props: any) {
    const { src, width, height, ...rest }  = props;

    rest.style = rest.style || [];
    rest.style.width = width;
    rest.style.height = height;

    const derivedProps = getDerivedProps(props);
    return createElement('img', { src, ...derivedProps});
}

export function Select(props: any) {
    const derivedProps = getDerivedProps(props);
    return createElement('select', derivedProps);
}

export function Input(props: any) {
    const derivedProps = getDerivedProps(props);
    return createElement('input', derivedProps);
}

export function Form(props: any) {
    const derivedProps = getDerivedProps(props);
    return createElement('form', derivedProps);
}

export function Pre(props: any) {
    const derivedProps = getDerivedProps(props);
    return createElement('pre', derivedProps);
}

export function Style(props: any) {
    const derivedProps = getDerivedProps(props);

    delete derivedProps.children;

    return Children.map(props.children, child => {

        let classProp = 'className';

        // Check if the element is a web component, use 'class=xxx' if so.
        try {
            if (typeof child.type === 'string' && /^[a-z]/.test(child.type) && child.type.includes('-')) {
                classProp = 'class';
            }
        } catch (e) { }

        let existingClass = child.props[classProp] || '';
        let newClass = derivedProps.className;

        if (newClass && newClass != '')
            newClass = existingClass + '  ' + newClass;

        const cloned = cloneElement(child, {
            ...derivedProps.finalProps,
            [ classProp ]: newClass
        });

        return cloned;
    });
}

