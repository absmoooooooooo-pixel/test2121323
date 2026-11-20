/*
 * Minimal DOM stub for parity tests.
 *
 * The calculator pages are written against a handful of DOM APIs; this stub
 * provides exactly those so the real page scripts can run under Node and be
 * compared with the backend.
 */
"use strict";

const vm = require("vm");

function fakeNode(id, doc) {
    const classes = new Set();
    const node = {
        id: id,
        value: "",
        textContent: "",
        innerHTML: "",
        innerText: "",
        hidden: false,
        disabled: false,
        checked: false,
        tagName: "DIV",
        nodeName: "DIV",
        children: [],
        childNodes: [],
        dataset: {},
        attributes: {},
        style: new Proxy(
            {},
            {
                get: (target, key) => (key in target ? target[key] : ""),
                set: (target, key, value) => {
                    target[key] = value;
                    return true;
                }
            }
        ),
        classList: {
            add: (name) => classes.add(name),
            remove: (name) => classes.delete(name),
            contains: (name) => classes.has(name),
            toggle: (name, force) => {
                if (force === undefined) {
                    if (classes.has(name)) {
                        classes.delete(name);
                    } else {
                        classes.add(name);
                    }
                    return classes.has(name);
                }
                if (force) {
                    classes.add(name);
                } else {
                    classes.delete(name);
                }
                return classes.has(name);
            }
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
        setAttribute: (name, value) => {
            node.attributes[name] = String(value);
        },
        getAttribute: (name) =>
            Object.prototype.hasOwnProperty.call(node.attributes, name)
                ? node.attributes[name]
                : null,
        removeAttribute: (name) => {
            delete node.attributes[name];
        },
        hasAttribute: (name) =>
            Object.prototype.hasOwnProperty.call(node.attributes, name),
        appendChild: (child) => {
            node.children.push(child);
            return child;
        },
        insertBefore: (child) => child,
        removeChild: () => null,
        replaceChildren: () => {},
        remove: () => {},
        cloneNode: () => fakeNode(id, doc),
        querySelector: () => fakeNode(id + "::q", doc),
        querySelectorAll: () => [],
        getElementsByTagName: () => [],
        closest: () => null,
        contains: () => false,
        focus: () => {},
        blur: () => {},
        scrollIntoView: () => {},
        click: () => {},
        getBoundingClientRect: () => ({
            width: 400,
            height: 300,
            top: 0,
            left: 0,
            right: 400,
            bottom: 300
        }),
        offsetWidth: 400,
        offsetHeight: 300,
        clientWidth: 400,
        clientHeight: 300
    };

    return node;
}

function createDocument() {
    const nodes = new Map();
    const ready = [];
    let api = null;

    const get = (id) => {
        if (!nodes.has(id)) {
            nodes.set(id, fakeNode(id, api));
        }
        return nodes.get(id);
    };

    api = {
        nodes: nodes,
        get: get,
        getElementById: get,
        createElement: (tag) => {
            const node = fakeNode("created-" + tag, api);
            node.tagName = String(tag).toUpperCase();
            return node;
        },
        createElementNS: (ns, tag) => {
            const node = fakeNode("created-" + tag, api);
            node.tagName = String(tag).toUpperCase();
            return node;
        },
        createTextNode: (text) => ({ nodeValue: text }),
        createDocumentFragment: () => fakeNode("fragment", api),
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementsByTagName: () => [],
        getElementsByClassName: () => [],
        addEventListener: (type, handler) => {
            if (type === "DOMContentLoaded") {
                ready.push(handler);
            }
        },
        removeEventListener: () => {},
        readyState: "loading",
        documentElement: fakeNode("html", api),
        head: fakeNode("head", api),
        body: fakeNode("body", api),
        title: "",
        activeElement: null,
        visibilityState: "visible",
        fireReady: () => {
            api.readyState = "complete";
            ready.forEach((handler) => handler({ type: "DOMContentLoaded" }));
        }
    };

    return api;
}

function createContext() {
    const document = createDocument();

    const context = {
        document: document,
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        requestAnimationFrame: (fn) => setTimeout(fn, 0),
        cancelAnimationFrame: clearTimeout,
        performance: { now: () => Date.now() },
        navigator: { userAgent: "node-parity", language: "en" },
        location: { href: "http://localhost/", origin: "http://localhost", search: "", pathname: "/" },
        localStorage: {
            _data: {},
            getItem(key) {
                return Object.prototype.hasOwnProperty.call(this._data, key)
                    ? this._data[key]
                    : null;
            },
            setItem(key, value) {
                this._data[key] = String(value);
            },
            removeItem(key) {
                delete this._data[key];
            },
            clear() {
                this._data = {};
            }
        },
        matchMedia: () => ({
            matches: false,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {}
        }),
        innerWidth: 1280,
        innerHeight: 900,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
        getComputedStyle: () => ({ getPropertyValue: () => "" }),
        alert: () => {},
        print: () => {},
        fetch: global.fetch,
        AbortController: AbortController,
        URL: URL,
        URLSearchParams: URLSearchParams,
        encodeURIComponent: encodeURIComponent,
        decodeURIComponent: decodeURIComponent,
        JSON: JSON,
        Math: Math,
        Number: Number,
        String: String,
        Object: Object,
        Array: Array,
        Error: Error,
        Map: Map,
        Set: Set,
        Promise: Promise,
        Date: Date,
        isFinite: isFinite,
        parseFloat: parseFloat,
        parseInt: parseInt
    };

    context.window = context;
    context.globalThis = context;
    context.self = context;

    return vm.createContext(context);
}

function run(context, code, filename) {
    vm.runInContext(code, context, { filename: filename });
}

module.exports = { createContext, run };
