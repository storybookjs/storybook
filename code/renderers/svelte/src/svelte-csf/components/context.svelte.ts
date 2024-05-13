import type { Meta, StoryContext, StoryObj } from "@storybook/svelte";
import type { StoryName } from "@storybook/types";
import {
	getContext,
	hasContext,
	setContext,
	type ComponentProps,
	type SvelteComponent,
} from "svelte";
import type { SetRequired } from "type-fest";

export interface StoriesExtractorContextProps<
	Component extends SvelteComponent = SvelteComponent,
> {
	render: boolean;
	register: {
		template: (template: AddonTemplateObj<Component>) => void;
		story: (story: AddonStoryObj<Component>) => void;
	};
}

export type AddonTemplateObj<Component extends SvelteComponent> = Omit<
	StoryObj<Component>,
	"render"
> & {
	id: string;
};

export type AddonStoryObj<Component extends SvelteComponent> = Omit<
	SetRequired<StoryObj<Component>, "name">,
	"render"
> & {
	templateId?: AddonTemplateObj<Component>["id"];
};

export function buildRegistrationContext<Component extends SvelteComponent>(
	props: StoriesExtractorContextProps<Component>,
) {
	let render = $state(props.render ?? false);
	let register = $state({
		template: props.register.template ?? (() => {}),
		story: props.register.story ?? (() => {}),
	});

	function set(props: StoriesExtractorContextProps<Component>) {
		render = props.render;
		register = props.register;
	}

	// function reset() {
	// 	render = false;
	// 	register = {
	// 		template: () => {},
	// 		story: () => {},
	// 	};
	// }

	return {
		get render() {
			return render;
		},
		get register() {
			return register;
		},
		set,
		// reset,
	};
}

export type RegistrationContext<Component extends SvelteComponent> = ReturnType<
	typeof buildRegistrationContext<Component>
>;

const CONTEXT_KEY_REGISTRATION = "storybook-registration-context";

export type StoriesRepository<Component extends SvelteComponent> = {
	meta: Meta<Component>;
	templates: Map<string, AddonTemplateObj<Component>>;
	stories: Map<StoryName, AddonStoryObj<Component>>;
};

export function createStoriesRegistrationContext<
	Component extends SvelteComponent,
>(repository: StoriesRepository<Component>): void {
	const { templates, stories } = repository;

	const ctx = buildRegistrationContext<Component>({
		render: false,
		register: {
			template: (t) => {
				console.log("CONTEXT - template", { t });
				templates.set(t.id, t);
			},
			story: (s) => {
				console.log("CONTEXT - story", { s });
				stories.set(s.name, s);
			},
		},
	});

	setContext(CONTEXT_KEY_REGISTRATION, ctx);

	// ctx.reset();
}

export function useStoriesRegistrationContext<
	Component extends SvelteComponent,
>() {
	const ctx = getContext<RegistrationContext<Component>>(
		CONTEXT_KEY_REGISTRATION,
	);
	$inspect(ctx).with(console.trace);

	// ctx.set({ render: true, register: ctx.register });

	return ctx;
}

interface StoryRenderContextProps<Component extends SvelteComponent> {
	args: ComponentProps<Component>;
	storyContext: StoryContext<ComponentProps<Component>>;
	templateId: string | undefined;
	storyName: string | undefined;
}

function buildStoryRenderContext<Component extends SvelteComponent>(
	props: StoryRenderContextProps<Component>,
) {
	let args = $state(props.args ?? {});
	let storyContext = $state(props.storyContext ?? {});
	let templateId = $state(props.templateId);
	let storyName = $state(props.storyName);

	function set(props: StoryRenderContextProps<Component>) {
		args = props.args;
		storyContext = props.storyContext;
		templateId = props.templateId;
		storyName = props.storyName;
	}

	function reset() {
		args = {} as ComponentProps<Component>;
		storyContext = {} as StoryContext<ComponentProps<Component>>;
		templateId = undefined;
		storyName = undefined;
	}

	return {
		get args() {
			return args;
		},
		get storyContext() {
			return storyContext;
		},
		get templateId() {
			return templateId;
		},
		get storyName() {
			return storyName;
		},
		set,
		reset,
	};
}

export type StoryRenderContext<Component extends SvelteComponent> = ReturnType<
	typeof buildStoryRenderContext<Component>
>;

const CONTEXT_KEY_STORY_RENDER = "storybook-story-render-context";

function createStoryRenderContext<Component extends SvelteComponent>(
	props: Partial<StoryRenderContextProps<Component>> = {},
): void {
	const ctx = buildStoryRenderContext({
		args: props.args ?? ({} as ComponentProps<Component>),
		storyContext:
			props.storyContext ?? ({} as StoryContext<ComponentProps<Component>>),
		templateId: props.templateId,
		storyName: props.storyName,
	});

	setContext(CONTEXT_KEY_STORY_RENDER, ctx);

	ctx.reset();
}

export function useStoryRenderContext<Component extends SvelteComponent>() {
	if (!hasContext(CONTEXT_KEY_STORY_RENDER)) {
		createStoryRenderContext<Component>();
	}

	return getContext<StoryRenderContext<Component>>(CONTEXT_KEY_STORY_RENDER);
}
