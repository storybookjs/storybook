import type { SvelteComponent } from 'svelte'
import type { Addon_BaseMeta as BaseMeta, Addon_BaseAnnotations as BaseAnnotations, StoryContext, WebRenderer } from '@storybook/types';


type DecoratorReturnType = void | SvelteComponent | {
    Component: any,
    props?: any
}

interface StoryProps extends BaseAnnotations<any, DecoratorReturnType, WebRenderer> {
    /**
     * Id of the story.
     * 
     * Optional, auto-generated from name if not specified.
     */
    id?: string;
    /**
     * Name of the story.
     */
    name: string;
    /**
     * Id of the template used by this story.
     * 
     * Optional. Used if the story has no body.
     * If not specified, use the 'default' template.
     */
    template?: string;
    /**
     * Specify which sources should be shown.
     * 
     * By default, sources for an args story are auto-generated.
     * If source is true, then the source of the story will be used instead.
     * If source is a string, it replaces the source of the story.
     */
    source?: boolean | string
}

interface TemplateProps extends BaseAnnotations<any, DecoratorReturnType> {
    /**
     * Id of the template.
     * 
     * Optional. Use 'default' if not specified.
     */
    id?: string;
}

interface Slots {
    default: {
        args: any;
        context: StoryContext;
        [key: string]: any;
    }
}
/**
 * Meta.
 */
export class Meta extends SvelteComponent<BaseMeta<any> & BaseAnnotations<any, DecoratorReturnType>> { }
/**
 * Story.
 */
export class Story extends SvelteComponent<StoryProps, any, Slots> { }
/**
 * Template.
 * 
 * Allow to reuse definition between stories.
 */
export class Template extends SvelteComponent<TemplateProps, any, Slots> { }
