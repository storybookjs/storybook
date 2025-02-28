// Whenever a ambient declaration changes, its number should be increased
// This way, we avoid the situation where multiple ambient versions of svelte2tsx
// are loaded and their declarations conflict each other
// See https://github.com/sveltejs/language-tools/issues/1059 for an example bug that stems from it
// If you change anything in this file, think about whether or not it should be backported to svelte-shims.d.ts

type AConstructorTypeOf<T, U extends any[] = any[]> = new (...args: U) => T;

/** @internal PRIVATE API, DO NOT USE */
type SvelteActionReturnType = {
	update?: (args: any) => void,
	destroy?: () => void
} | void

/** @internal PRIVATE API, DO NOT USE */
type SvelteTransitionConfig = {
    delay?: number,
    duration?: number,
    easing?: (t: number) => number,
    css?: (t: number, u: number) => string,
    tick?: (t: number, u: number) => void
}

/** @internal PRIVATE API, DO NOT USE */
type SvelteTransitionReturnType = SvelteTransitionConfig | (() => SvelteTransitionConfig)

/** @internal PRIVATE API, DO NOT USE */
type SvelteAnimationReturnType = {
    delay?: number,
    duration?: number,
    easing?: (t: number) => number,
    css?: (t: number, u: number) => string,
    tick?: (t: number, u: number) => void
}

/** @internal PRIVATE API, DO NOT USE */
type SvelteWithOptionalProps<Props, Keys extends keyof Props> = Omit<Props, Keys> & Partial<Pick<Props, Keys>>;
/** @internal PRIVATE API, DO NOT USE */
type SvelteAllProps = { [index: string]: any }
/** @internal PRIVATE API, DO NOT USE */
type SveltePropsAnyFallback<Props> = {[K in keyof Props]: Props[K] extends never ? never : Props[K] extends undefined ? any : Props[K]}
/** @internal PRIVATE API, DO NOT USE */
type SvelteSlotsAnyFallback<Slots> = {[K in keyof Slots]: {[S in keyof Slots[K]]: Slots[K][S] extends undefined ? any : Slots[K][S]}}
/** @internal PRIVATE API, DO NOT USE */
type SvelteRestProps = { [index: string]: any }
/** @internal PRIVATE API, DO NOT USE */
type SvelteSlots = { [index: string]: any }
/** @internal PRIVATE API, DO NOT USE */
type SvelteStore<T> = { subscribe: (run: (value: T) => any, invalidate?: any) => any }

// Forces TypeScript to look into the type which results in a better representation of it
// which helps for error messages and is necessary for d.ts file transformation so that
// no ambient type references are left in the output
/** @internal PRIVATE API, DO NOT USE */
type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

/** @internal PRIVATE API, DO NOT USE */
type KeysMatching<Obj, V> = {[K in keyof Obj]-?: Obj[K] extends V ? K : never}[keyof Obj]
/** @internal PRIVATE API, DO NOT USE */
declare type __sveltets_2_CustomEvents<T> = {[K in KeysMatching<T, CustomEvent>]: T[K] extends CustomEvent ? T[K]['detail']: T[K]}

declare function __sveltets_2_ensureRightProps<Props>(props: Props): {};
declare function __sveltets_2_instanceOf<T = any>(type: AConstructorTypeOf<T>): T;
declare function __sveltets_2_allPropsType(): SvelteAllProps
declare function __sveltets_2_restPropsType(): SvelteRestProps
declare function __sveltets_2_slotsType<Slots, Key extends keyof Slots>(slots: Slots): Record<Key, boolean>;

// Overload of the following two functions is necessary.
// An empty array of optionalProps makes OptionalProps type any, which means we lose the prop typing.
// optionalProps need to be first or its type cannot be infered correctly.

declare function __sveltets_2_partial<Props = {}, Events = {}, Slots = {}, Exports = {}, Bindings = string>(
    render: {props: Props, events: Events, slots: Slots, exports?: Exports, bindings?: Bindings }
): {props: Expand<SveltePropsAnyFallback<Props>>, events: Events, slots: Expand<SvelteSlotsAnyFallback<Slots>>, exports?: Exports, bindings?: Bindings }
declare function __sveltets_2_partial<Props = {}, Events = {}, Slots = {}, Exports = {}, Bindings = string, OptionalProps extends keyof Props = any>(
    optionalProps: OptionalProps[],
    render: {props: Props, events: Events, slots: Slots, exports?: Exports, bindings?: Bindings }
): {props: Expand<SvelteWithOptionalProps<SveltePropsAnyFallback<Props>, OptionalProps>>, events: Events, slots: Expand<SvelteSlotsAnyFallback<Slots>>, exports?: Exports, bindings?: Bindings }

declare function __sveltets_2_partial_with_any<Props = {}, Events = {}, Slots = {}, Exports = {}, Bindings = string>(
    render: {props: Props, events: Events, slots: Slots, exports?: Exports, bindings?: Bindings }
): {props: Expand<SveltePropsAnyFallback<Props> & SvelteAllProps>, events: Events, slots: Expand<SvelteSlotsAnyFallback<Slots>>, exports?: Exports, bindings?: Bindings }
declare function __sveltets_2_partial_with_any<Props = {}, Events = {}, Slots = {}, Exports = {}, Bindings = string, OptionalProps extends keyof Props = any>(
    optionalProps: OptionalProps[],
    render: {props: Props, events: Events, slots: Slots, exports?: Exports, bindings?: Bindings }
): {props: Expand<SvelteWithOptionalProps<SveltePropsAnyFallback<Props>, OptionalProps> & SvelteAllProps>, events: Events, slots: Expand<SvelteSlotsAnyFallback<Slots>>, exports?: Exports, bindings?: Bindings }


declare function __sveltets_2_with_any<Props = {}, Events = {}, Slots = {}, Exports = {}, Bindings = string>(
    render: {props: Props, events: Events, slots: Slots, exports?: Exports, bindings?: Bindings }
): {props: Expand<Props & SvelteAllProps>, events: Events, slots: Slots, exports?: Exports, bindings?: Bindings }

declare function __sveltets_2_with_any_event<Props = {}, Events = {}, Slots = {}, Exports = {}, Bindings = string>(
    render: {props: Props, events: Events, slots: Slots, exports?: Exports, bindings?: Bindings }
): {props: Props, events: Events & {[evt: string]: CustomEvent<any>;}, slots: Slots, exports?: Exports, bindings?: Bindings }

declare function __sveltets_2_store_get<T = any>(store: SvelteStore<T>): T
declare function __sveltets_2_store_get<Store extends SvelteStore<any> | undefined | null>(store: Store): Store extends SvelteStore<infer T> ? T : Store;
declare function __sveltets_2_any(dummy: any): any;
declare function __sveltets_2_invalidate<T>(getValue: () => T): T

declare function __sveltets_2_mapWindowEvent<K extends keyof HTMLBodyElementEventMap>(
    event: K
): HTMLBodyElementEventMap[K];
declare function __sveltets_2_mapBodyEvent<K extends keyof WindowEventMap>(
    event: K
): WindowEventMap[K];
declare function __sveltets_2_mapElementEvent<K extends keyof HTMLElementEventMap>(
    event: K
): HTMLElementEventMap[K];

declare function __sveltets_2_bubbleEventDef<Events, K extends keyof Events>(
    events: Events, eventKey: K
): Events[K];
declare function __sveltets_2_bubbleEventDef(
    events: any, eventKey: string
): any;

declare const __sveltets_2_customEvent: CustomEvent<any>;
declare function __sveltets_2_toEventTypings<Typings>(): {[Key in keyof Typings]: CustomEvent<Typings[Key]>};

declare function __sveltets_2_unionType<T1, T2>(t1: T1, t2: T2): T1 | T2;
declare function __sveltets_2_unionType<T1, T2, T3>(t1: T1, t2: T2, t3: T3): T1 | T2 | T3;
declare function __sveltets_2_unionType<T1, T2, T3, T4>(t1: T1, t2: T2, t3: T3, t4: T4): T1 | T2 | T3 | T4;
declare function __sveltets_2_unionType(...types: any[]): any;

declare function __sveltets_2_createSvelte2TsxComponent<Props extends {}, Events extends {}, Slots extends {}>(
    render: {props: Props, events: Events, slots: Slots }
): typeof import("svelte").SvelteComponent<Props, Events, Slots>;

declare function __sveltets_2_unwrapArr<T>(arr: ArrayLike<T>): T
declare function __sveltets_2_unwrapPromiseLike<T>(promise: PromiseLike<T> | T): T

// v2
declare function __sveltets_2_createCreateSlot<Slots = Record<string, Record<string, any>>>(): <SlotName extends keyof Slots>(slotName: SlotName, attrs: Slots[SlotName]) => Record<string, any>;
declare function __sveltets_2_createComponentAny(props: Record<string, any>): import("svelte").SvelteComponent<any, any, any>;

declare function __sveltets_2_any(...dummy: any[]): any;
declare function __sveltets_2_empty(...dummy: any[]): {};
declare function __sveltets_2_union<T1,T2,T3,T4,T5,T6,T7,T8,T9,T10>(t1:T1,t2?:T2,t3?:T3,t4?:T4,t5?:T5,t6?:T6,t7?:T7,t8?:T8,t9?:T9,t10?:T10): T1 & T2 & T3 & T4 & T5 & T6 & T7 & T8 & T9 & T10;
declare function __sveltets_2_nonNullable<T>(type: T): NonNullable<T>;

declare function __sveltets_2_cssProp(prop: Record<string, any>): {};

// @ts-ignore Svelte v3/v4 don't have this
declare function __sveltets_2_ensureSnippet(val: ReturnType<import('svelte').Snippet> | undefined | null): any;

/** @internal PRIVATE API, DO NOT USE */
type __sveltets_2_SvelteAnimationReturnType = {
    delay?: number,
    duration?: number,
    easing?: (t: number) => number,
    css?: (t: number, u: number) => string,
    tick?: (t: number, u: number) => void
}
declare var __sveltets_2_AnimationMove: { from: DOMRect, to: DOMRect }
declare function __sveltets_2_ensureAnimation(animationCall: __sveltets_2_SvelteAnimationReturnType): {};

/** @internal PRIVATE API, DO NOT USE */
type __sveltets_2_SvelteActionReturnType = {
	update?: (args: any) => void,
	destroy?: () => void,
    $$_attributes?: Record<string, any>,
} | void
declare function __sveltets_2_ensureAction<T extends __sveltets_2_SvelteActionReturnType>(actionCall: T): T extends  {$$_attributes?: any} ? T['$$_attributes'] : {};

/** @internal PRIVATE API, DO NOT USE */
type __sveltets_2_SvelteTransitionConfig = {
    delay?: number,
    duration?: number,
    easing?: (t: number) => number,
    css?: (t: number, u: number) => string,
    tick?: (t: number, u: number) => void
}
/** @internal PRIVATE API, DO NOT USE */
type __sveltets_2_SvelteTransitionReturnType = __sveltets_2_SvelteTransitionConfig | (() => __sveltets_2_SvelteTransitionConfig)
declare function __sveltets_2_ensureTransition(transitionCall: __sveltets_2_SvelteTransitionReturnType): {};

// Includes undefined and null for all types as all usages also allow these
declare function __sveltets_2_ensureType<T>(type: AConstructorTypeOf<T>, el: T | undefined | null): {};
declare function __sveltets_2_ensureType<T1, T2>(type1: AConstructorTypeOf<T1>, type2: AConstructorTypeOf<T2>, el: T1 | T2 | undefined | null): {};

// The following is necessary because there are two clashing errors that can't be solved at the same time
// when using Svelte2TsxComponent, more precisely the event typings in
// __sveltets_2_ensureComponent<T extends new (..) => _SvelteComponent<any,||any||<-this,any>>(type: T): T;
// If we type it as "any", we have an error when using sth like {a: CustomEvent<any>}
// If we type it as "{}", we have an error when using sth like {[evt: string]: CustomEvent<any>}
// If we type it as "unknown", we get all kinds of follow up errors which we want to avoid
// Therefore introduce two more base classes just for this case.
/**
 * Ambient type only used for intellisense, DO NOT USE IN YOUR PROJECT
 */
declare type ATypedSvelteComponent = {
    /**
     * @internal This is for type checking capabilities only
     * and does not exist at runtime. Don't use this property.
     */
    $$prop_def: any;
    /**
     * @internal This is for type checking capabilities only
     * and does not exist at runtime. Don't use this property.
     */
    $$events_def: any;
    /**
     * @internal This is for type checking capabilities only
     * and does not exist at runtime. Don't use this property.
     */
    $$slot_def: any;

    $on(event: string, handler: any): () => void;
}
/**
 * Ambient type only used for intellisense, DO NOT USE IN YOUR PROJECT.
 * 
 * If you're looking for the type of a Svelte Component, use `SvelteComponent` and `ComponentType` instead:
 *
 * ```ts
 * import type { ComponentType, SvelteComponent } from "svelte";
 * let myComponentConstructor: ComponentType<SvelteComponent> = ..;
 * ```
 */
declare type ConstructorOfATypedSvelteComponent = new (args: {target: any, props?: any}) => ATypedSvelteComponent
// Usage note: Cannot properly transform generic function components to class components due to TypeScript limitations
declare function __sveltets_2_ensureComponent<
    T extends
        | ConstructorOfATypedSvelteComponent
        | (typeof import('svelte') extends { mount: any }
              ? // @ts-ignore svelte.Component doesn't exist in Svelte 4
                import('svelte').Component<any, any, any>
              : never)
        | null
        | undefined
>(
    type: T
): NonNullable<
    T extends ConstructorOfATypedSvelteComponent
        ? T
        : typeof import('svelte') extends { mount: any }
          ? // @ts-ignore svelte.Component doesn't exist in Svelte 4
            T extends import('svelte').Component<
                infer Props extends Record<string, any>,
                infer Exports extends Record<string, any>,
                infer Bindings extends string
            >
              ? new (
                    options: import('svelte').ComponentConstructorOptions<Props>
                ) => import('svelte').SvelteComponent<Props, Props['$$events'], Props['$$slots']> &
                    Exports & { $$bindings: Bindings }
              : never
          : never
>;

declare function __sveltets_2_ensureArray<T extends ArrayLike<unknown> | Iterable<unknown>>(array: T): T extends ArrayLike<infer U> ? U[] : T extends Iterable<infer U> ? Iterable<U> : any[];

type __sveltets_2_PropsWithChildren<Props, Slots> = Props &
    (Slots extends { default: any }
        // This is unfortunate because it means "accepts no props" turns into "accepts any prop"
        // but the alternative is non-fixable type errors because of the way TypeScript index
        // signatures work (they will always take precedence and make an impossible-to-satisfy children type).
        ? Props extends Record<string, never>
        ? any
        : { children?: any }
        : {});
declare function __sveltets_2_runes_constructor<Props extends {}>(render: {props: Props }): import("svelte").ComponentConstructorOptions<Props>;

declare function __sveltets_2_get_set_binding<T>(get: (() => T) | null | undefined, set: (t: T) => void): T;

declare function __sveltets_$$bindings<Bindings extends string[]>(...bindings: Bindings): Bindings[number];

declare function __sveltets_2_fn_component<
    Props extends Record<string, any>, Exports extends Record<string, any>, Bindings extends string
    // @ts-ignore Svelte 5 only
>(klass: {props: Props, exports?: Exports, bindings?: Bindings }): import('svelte').Component<Props, Exports, Bindings>;

interface __sveltets_2_IsomorphicComponent<Props extends Record<string, any> = any, Events extends Record<string, any> = any, Slots extends Record<string, any> = any, Exports = {}, Bindings = string> {
    new (options: import('svelte').ComponentConstructorOptions<Props>): import('svelte').SvelteComponent<Props, Events, Slots> & { $$bindings?: Bindings } & Exports;
    (internal: unknown, props: Props extends Record<string, never> ? {$$events?: Events, $$slots?: Slots} : Props & {$$events?: Events, $$slots?: Slots}): Exports & { $set?: any, $on?: any };
    z_$$bindings?: Bindings;
}

declare function __sveltets_2_isomorphic_component<
    Props extends Record<string, any>, Events extends Record<string, any>, Slots extends Record<string, any>, Exports extends Record<string, any>, Bindings extends string
>(klass: {props: Props, events: Events, slots: Slots, exports?: Exports, bindings?: Bindings }): __sveltets_2_IsomorphicComponent<Props, Events, Slots, Exports, Bindings>;

declare function __sveltets_2_isomorphic_component_slots<
    Props extends Record<string, any>, Events extends Record<string, any>, Slots extends Record<string, any>, Exports extends Record<string, any>, Bindings extends string
>(klass: {props: Props, events: Events, slots: Slots, exports?: Exports, bindings?: Bindings }): __sveltets_2_IsomorphicComponent<__sveltets_2_PropsWithChildren<Props, Slots>, Events, Slots, Exports, Bindings>;
