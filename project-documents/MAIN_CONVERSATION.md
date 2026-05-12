Necessary context for the conversation:

1. Inner Loop: (generally local development on an engineer's local machine [macbook]) Engineer kicks off a Claude session, says "Build Feature X". Claude uses Storybook to understand context of the company's Design System to write/generate new code, including new stories. Claude evaluates its own new code output, and keeps looping and making changes until it thinks it got the feature right. Then, it shows this new feature to the Engineer (ideally with Storybook), who reviews it, and then approves opening up a Pull Request in Github. Now we start the outer loop.

2. Outer Loop: (generally in the cloud, aka github.com and chromatic.com) Chromatic is run with the pull request. Chromatic automatically brings in the right stakeholders, like Designers, Product Managers, other Engineers, to review the UI changes in Chromatic. They find UI that needs changes, they comment on this in Chromatic. This feedback is automatically sent back to the Engineer / Claude, and the inner loop starts again to make these changes (and instead of "Build Feature X", Claude is now following the prompt "Fix Feature X based on feedback Y from Chromatic")

3. VTA means visual tests addon https://github.com/chromaui/addon-visual-tests

4. https://www.meticulous.ai/ is a test automation tool

5. Prototype for the "before/after review page" https://github.com/storybookjs/storybook/pull/34569

Details about the inner loop agentic diff project pitch:

1. project details are in the project-documents/Private & Shared/INNER_LOOP.md file
2. flow image is in project-documents/Private & Shared/INNER_LOOP.md

Transcript conversation between Yann and Valentin:

Yeah. So hopefully no... false negatives. but very likely a bunch of positives.

But you mean because the agent having the git diff and the module graph...

Wait, we are not talking about the agent yet, just about the status quo.

Oh, okay.

Yeah, so the status quo is we have the module graph, we have the git diff. We can say which stories may have changed by going down the module graph or we have also a reverse index in place where we have a list of stories mapping to all the files which relate to that story in the sense of what the story actually important. So we have that reverse list. So we have a lib or a mapping of story to story files, which may change that stuff because the story imports that file either directly or via a transitive import, where I want you, right?

So we have that information. And therefore, that's what I try to say, is hopefully we don't have any kind of false negatives, meaning that the modul ground missed Right. and then your component may use it but just one story of the 20 stories you have written for that component actually showcases that utility usage yeah this feels more like a yeah a code coverage kind of thing yeah yeah exactly that's why i also have the idea of well let's compute component coverage per story isolated and then we get the information which we need but that's not the problem project aboutThis project is now about to leverage the agent and hope that the agent can figure out the information for us and reduces the list of false positives.

And if you ask me how that could be achieved on a high level, it's well, let's give the agent Um... Look at that. As shown here, let's give the agent the volume bra. So Shaney is saying which stories may be affected. And what the agent then has to do is theoretically scale scan all the files and figure out or scan all the stories It's very complicated.

That's not complicated, Yeah, exactly.

So let's take just that example of a button component. You change the button component. Then we may have the information of the directly modified story, which is the button stories TSX and all the other files are related or related, affected in a way. But in Chromatic's case, it's like 2000 stories. So should the agent now scan all the 2000 stories to give you the exact list of where a component is?

Yeah.

So I'm not sure what the goal here is to get the agent in so that the agent could give you a filtered list of...

And also, if you don't have coverage data, then the agent needs to somehow assume the entire code paths and the flows, take a look into all of the story before each hooks, after each hooks, the play function and reconstruct the flow somehow to see whether that is actually going to be affecting that specific utility. That's too much.

It has to reason about the business logic without having actually any kind of static analysis tools or any kind of... symbol tracing capabilities or whatsoever, right? There are actually tools independent of this project. One is called Serena, which does exactly that. Serena is an MCP which provides you tools like more or less TypeScript does, where you can say, find references by symbol and then the agent passes an export from a file and that MCP, Serena MCP, gives you all the files where that symbol is used, TypeScript would give it to you by using the IDE feature, right-clicking on the symbol and show find by references.

That's what the agent would have been provided as well, but that's Storybook independent. I'm just... The question in which I have is, Do we need to install some further kind of MCPs for the user so that this works because the pure raw approach right the brute force approach That might not work that great since the context just fills up too fast.

And I think nowadays people are getting more cautious about token usage and all of a sudden they're like, okay, I'm just changing one thing with the storybook. Turns out that it cost me like, I don't know. $10 per request or $20 per request and then I don't I'm out of my limit. I don't want to use store book anymore With AI, you know, that kind of thing. I think it's some worry that we need to think about so that people don't react negatively to this. That's correct.

So maybe, maybe You can implement that. but with some kind of how to say, drawbacks, or you say, well, only if the storybook MCP returns as a list of 20 stories, we can say, well, the agent may figure it out. For example, Michael ran into an issue on the reshape design system, I think, where one file, so he did an adjustment in a utility file, And one story was marked as modified, so directly related, and three stories were marked as affected.

The modified story was due to the distance to the utility file it was the nearest one so therefore it was marked as modified. It actually didn't show the usage of that utility, but one of the affected stories instead, because it used a calendar component in a way where that subsection was shown and whatsoever. So the distance to a particular component file or module is a good heuristic, but there are edge cases, unfortunately, where it doesn't give you the right information.

This new button which we have introduced in the sidebar to filter for new and modified components, but not for effective because we don't feel certain about it, would just select or show you the modified one which actually doesn't highlight the change. It's frustrating. And that's what Michael wants to circumvent, to not have this kind of... frustrating behavior. But to come back to this kind of graph which we show in front of us.

Let's say we adjust the Storybook MCPs kind of system prompt instructions and we say, well, whenever you change a file, please make sure to call Storybook MCP to get the list of potentially modified stories and also the gif div and maybe also the module graph for these modified stories. And then the agent should reason about which stories likely has changed. And then call another storybook MCP to actually Um, to actually actually Wait, so now we can go into two directions, right?

So either the agent calls another storybook tool MCP, which then actually controls the user's browser session and navigates the user to a kind of comparison page where these kind of selected stories are shown or the agent itself opens a new url with a specific uh url parameter and um and then it filters down the stories but by what yeah story ideas it feels maybe internally called the storebook mcp to apply some hidden tags so that tax filtering could be used right that could be another approach It feels to me that there should be some orchestration layer where on the Node side the agent is calling some API and defining the context, right?

Like which stories to visit, which page to visit, something like that. And then Storybook reacts to it. Although we also need to take into account that there could be multiple tabs open I guess we want only that one particular tab to react to this.

Right, right, right. So I think the second solution would be that the agent either provides a dual or just calls it into its preview ADE agent kind of view, right? And then propends a special parameter and maybe internally via an MCP tool it has applied some tax. Right, and then it just filters for these tags.

So I could imagine that, well, the agent does that work, figuring out, well, which stories matter, right?

And then let's say it figured out three stories. What it does now, it calls the Storybook MCP, which is connected to the running Storybook backend, and it allows the MCP by a tool call to say, well, I want to apply be special Review tag.

But then virtually? or in the actual file system. Thanks. virtually yeah yeah i think virtually possible So, or completely different, it would just set a status, right?

Where the status API.

So you could have an agent review status added to the existing pre-statuses that's better actually which doesn't immediately in filtering and which also doesn't have any icons or whatever.

But you could filter it via query parameters because that's what we have introduced, right? Every kind of status could be applied by a query parameter and therefore it would filter the stories related to that.

So that could be a nice solution. I mean, it's a nice solution to to fixing the problem of knowing what to show in the UI. Yes. But the other problem, the bigger problem, which is how to detect what to show is the biggest thing and what we need to challenge in this project, right? I have the feeling you need evals here again. for this projectProbably, no, very, very likely because we also wanna assert that the cost and time is within a good range, right? Because otherwise we're going to be shipping something that takes a long time and costs a lot of people.

And it's so much better to just like have the false positive or false negative scenario than having to wait like two minutes or something. But do you kind of foresee any Because the biggest issue here is that the agent has to do a lot, right? And we want to make sure that the agent has less effort by providing tools But those tools need to be somehow deterministic, right? Do you see anything extra that we can do that like an API that receives all the contacts and does some...

So this is one approach of just using the agent, but my gut feeling is that the agent will have a hard time to figure these things out. So the whole project could also be changed to leverage our Vitas integration and then say, well, whatever the model graph in combination with returns we have this pre-filtered list of stories and then we run the tests upon them with coverage enabled but now comes the tricky part vtest is not capable to just enable coverage and do the coverage calculation in a isolated fashion it always accumulates the coverage results or stories for a particular file right so we have to figure that out if we would have access to chrome directly it would be so easy but in this case we have to figure out what vtest gives us and then Maybe we have to start dedicated V-test sessions per story file so that we have that kind of encapsulation.

That also takes a long time.

Yeah, and then we have some other levels here as well is that hopefully the whole kind of source maps mapping is correct. That's true. So that we can map back to the source file. So it has other kind of-Yeah, challenges I would say, but that would at least be a deterministic way of figuring out whether a particular Business logic change or file change has led to a change in the story.

What about having the storybook If it's an agent accession, Then you have to pay the price, let's say, to have V-test. Run in watch mode. So at the very beginning, even before doing stuff, then we actually do a full run. Auf Wiedersehen and watch mode with coverage. Um... I don't remember if coverage is able...

Well, you mentioning that, that's pretty great that you mentioned that because then we even don't need the module graph and we even don't need the dip since V-test itself, If I remember correctly, when I built that, there was a function which I built which essentially figures out what changed based on these module graph, which already is more accurate to the module graph I've built.

I see. It's more or less 100% accurate. And that list could be also taken to just provide it to the agent.

But there might be some timing issues since the agent doesn't change, then Vtest runs and Yeah, because then if you start the session with coverage mode then from there on we already have the baselines we already know Now the only challenge would be if the user has like a weird configuration that changes the source maps and therefore we can't connect.

Maybe if tests were ran at least once or Yeah, so that's what I'm saying.

Like it's you have to pay the cost, the cost of running your entire testing suite so that we have like a good baseline. And that could be very problematic for like the chromatic code base, which has 2000 stories.

But hold on, right?

So, so V tests kind of and our approach of detecting which tests to run is also only based on the module graph.

We just eliminate that kind of 5% overlap which VIT in combination with V-Test might give you additionally to how maybe special kind of transformers are in place to have a more exact module graph. But the problem still remains the same of Well, the MautheGraph doesn't expose you what has changed. Exactly which story has changed, but just likely which story has changed. So we just eliminate that gap of being a bit more accurate of what the volume graph is.

And my modulagraph approach would be also faster than vtest's one because it doesn't rely on populating the whole molybdenum graph in vtest or running all the tests.

Do you know what I mean by covering the gap? But then we do have the coverage, which we wouldn't have just with the module graph.

Oh yeah, yeah.

We talk about the coverage, you are right, but But as it... Right.

give you the coverage report per story execution. Not even per-story-file execution, but per-story execution even harder. Is it possible to change the way that we transform story files to test files to somehow tag each? Test. in a particular way? I'm not sure about that, right?

Because what you are doing, and that's pretty easy, is you have a story file, you have a transformer, you transform it to a test file. But now you would have to teach V to say, No.

Go wear this, you bugs.

Yeah. I don't know. The more we talk about this, the more I wonder if this project makes sense.

So I wonder like what's the The pitch?

But Valentin, what's your take on this? Do you feel like it's worth pursuing this project? Like the amount of effort and the end result could be like Costly, slow, still unreliable. Also, a solution that only works for agents. So we're going to be adding quite some complexity for something that really only relies on agents. Unless we go on this different route of like collecting the coverage and trying to be more deterministic I mean, that's one part of the project, right?

The other part is also building that review page, which would be based upon my POC, right? So that's also another part.

Good point.

And zooming out also might be just, well, we show the modified stories and then we zoom out to the affected ones.

And the affected ones, they could be thousands of stories. So which one to select here?

And then that's really a hard... Could it be that we just say, well, we...

I mean, couldn't this be a good subtle argument to say we It just works with VTA where VTA gives us that specific information and the filtered list of stories which actually have changed. But the METI apron just takes so long.

Yeah, it's going to be even worse. But also... but also VTA is gonna have similar problems, right? Like if you change a button And then it affects many things then You get like a thousand results. But that's not how chromatic works, right? Chromatic only Highlights. Oh, the visual changes, sure. Visual changes. So you're saying that if I have a utility file that has nothing to do with anything and that utility file, it wouldn't show anything and therefore the results on the sidebar would be actually more effective.

Turns out that the utility changes didn't affect anything. Is that what you mean? Right, right.

That's up. That's what it is about. We want to review visual changes on. components for which we have written stories for.

Yeah. But it feels to me that it might be not really acceptable to have this flow work only if you have the visual tests add-on and a chromatic account. Yeah, it's slow and I agree. But do you feel like there should be a two-layer thing? If you have VTA, then we rely on VTA instead. But then we need to like make it fast because otherwise it's ridiculous. Yeah, well, the other approach is that we introduce VBRT locally, right?

Save screenshots when you start up Storybook for all the stories that we have, and then every time we do a change based on the module graph, we do... the screenshotting for all the components B. They may be related and then based on some algorithms, some kind ofImage two.

But then you test against which baseline?

The baseline when you start a storybook without the agent having done any changes yet.

So some... Okay, then somehow you now have a... you have the V test thing running in watch mode, generating all the snapshots somewhere outside of your project, because otherwise people are gonna be like, why do I have all of a sudden so many files? And then if people have like file system, you know space issues or storage issues all of a sudden and they're like what's going on Yeah. Yeah. It seems like there's no good solution here.

I mean, maybe I underestimate the agent's capabilities of figuring out which stories may be effective.

which may not. Well, I mean, I don't think we need to underestimate these capabilities, but we can't overestimate how good context windows are, right? Maybe people are going to be like, oh my gosh, I am over my five hour limit from Cloud Max just by using this thing for five minutes. Just because of the amount of context and and that's the challenge if we can't produce tools that reduce it to the context Usage. then this project is really hard to succeed.

I think we can rely on agents, but what if people are using Haiku or whatever else? Like some chat GPT for... Which is super silly. then it's gonna take even longer and it's not gonna Good. The results might actually be incorrect.

So problem which we tried to solve, it's really an industry problem.

I'm meeting AI.

This is what I, while playing around with a lot of tools recently, a lot of tools really try to solve, whether it's Graphify, which tries to build a kind of module graph from your repository, or where there are some other tools like ContextMem, which tries to understand different kind of relations inside of your repository. So it would be great if we crack it as part of the storybook.

I just don't see it. So...

So maybe we have to go that route which Steve has suggested, right? Of doing that kind of core flow business logic.

What's that?

Well, to understand which kind of business logic relies on which pieces of code.

I didn't see that proposal. I don't know what...

Is he?

Well, Oh, I see.

Yeah. But even if that is the case, and we do detect that the specific business logic connects to specific components, We still need to know how a story ends up touching that piece of business logic, right?

That's super hard. Yeah.

It is also about, well, which kind of provider you are setting, right? Or decorator, which may influence how this component is then shown. or you have YARGs as the most simplest kind of thing, I guess.

Yeah, but also the play function and the loaders and the after each and before each hooks. It's impossible. And you might be using mock service worker to mock things, which means that the network request is going to respond with a specific code and then trigger specific code flow in the component file. So it's like-It's just... An industry issue that you say and somehow Vanessa wants the prototype in two weeks and then we finish the project in the upcoming four weeks.

The only solution here is component coverage if we don't want to do the screenshot. And we have to figure out how to do that in an isolated fashion. And then imagine Let's take our utils file example once again. So you have a utils file, you do a import at the top and we filter out imports because we know imports themselves Let's say the import themselves, they don't matter because if you import a utility file, everything what is on the module level will be executed, right? So everything what is inside of the, on the module's goal has to be executed kind of. So, and then we introduce an export in that utility file, a new utility function, right?

We export it and it has its function body or its, yeah, module, And with component coverage we can say, well, if one story runs, it runs and then we see in coverage, oh, well, the function body was actually not executed at all, right? So we can say, well, that story doesn't rely on it. And then another story runs again, and then, oh, well, these lines are covered, right? And then we can say, yeah, it was executed by that story.

Um And then we don't need that agent. We don't need the agent to reason about it. Okay, Neil.

But only if we do get the...

Yeah, I think that you have to...

Maybe this should be rather inspired than... Action project.

Um, But it's tightly connected to the outer loop agentic diff project or something. But even if we were to not consider imports, what about side effects? that come from imports. That's also possible. You might have a top level function that gets called somehow or some CSS or whatever JS that gets imported as a side effect from the dependency, like so many nodes.

Maybe imports.

How are these imports called?

Not default imports, but imports which actually don't import anything from the file.

Imperative imports? I don't know. Side effects? Yes.

That's how you look at him, boss.

Right, but they just...

But it's not the only thing. You might be importing something from a file and truly using that, but then inside of that other file, there is a side effect import or not even. There might just be like normal module imports, but inside of those files, there is actually something like you are injecting something to the global scope. You are calling specific JS code. You are having like a iffy immediately invoked function expression thing.

That would be. Yeah, I think there's so many things that we need to find out a good solution and then account for all of those use cases that might just not be supported at all. I feel so sorry for you-That's a problem, it's just so annoying. God's straightforward. Mean I feel like Mike was trying to come up with all kinds of ideas and it's really hard for him of course like to find stuff that really makes a lot of sense and we have this pitch which has been accepted and the project will start in two weeks or a week and a few days, but it doesn't mean that You know, this is a perfect thing that is just going to work out. So I think it's fine to challenge it.

And also the reason I wanted to chat with you, and in fact, just disclaimer, I am doing a Notion transcript thing. So that's... Wait, do you still hear me? Hello Yeah. So disclaimer, I am doing the, the notion transcript thing so that, because of course I'm not going to remember all the details we, we spoke about and then I want to, I want to, um, Turn this into actual like questions so we did so that we can discuss and see whether we would be okay with the end result of this project.

And I do feel like you mentioned, the review page is in isolated deliverable of this project, which I think makes sense to do. And we actually have a pretty good solution not accounting for any of the agent stuff right just accounting for what we have currently which is the affected and modified statuses and that on its own is a deliverable. The agentic part feels like the stretch slash spike necessary thing because it honestly just It's not doable, especially in a couple of weeks.

And if we really want to do this right, there's so much eval stuff that has to be done. So we not only need to build the review page, but also the mechanism for the review page to get triggered in normal ways, but also to get triggered through an API via the agent somehow. But then we also need to change the whole eval system to support this use case because it's currently very hard coded to the automated setup project.

So we're gonna make maybe even like create a second branch to that. Evil scripts? And then we're going to have to run all of that all the time. So there's just too much stuff to do in a short amount of time.

Yeah, well it's also about assumptions here. Sure. We could also What we could also say is, well, without chromatic or without screenshots or without component coverage, even the agent will never figure out what's correct. So let's... as a goal let's try to reduce the number of positives and we could also approach it to let's take the butter component once again in chromatic which has like 2000 kind of side effects and maybe i haven't i haven't looked into it once again to see well why are all these 2000 screens actually um affected maybe it was because of barrel file handling which now is better than in previous versions.

But maybe because actually, well, a button component is on every page, right? So definitely. The question I think which I... Maybe one part of the solution is to make the review page a bit smarter by doing the following. Let me just find what I have. 1.11 seconds. French industry. Yeah.

So One thing which might be interesting is would be What the... Okay.

to say, well, maybe that review screen, maybe it does batching, right? Maybe batching by depth Oh. Right, that we could say, well, just because what meticulous.ai (the product) is doing is exactly that. It batches related changes and then it shows you just one version and if you accept it, all the other versions are also accepted. And we could do maybe something very similar for the review changes one so that the agent, and maybe that could be an interesting approach.

that the agent gets the module graph, it gets the git div, and it gets the list of all stories which have changed. And the agent's job is to categorize maybe them, right? So that it's easier for the user to have these categories of changes and then just take a look at the first and not to all of them.

I like that. And then when it comes to, let's say, zoom levels, you can even like go zoom in or out based on the... the level of things similar to like accessibility that if you fix one accessibility in a single button you end up fixing many things in other components on the zoomed out state Right.

Because the major advantage of this approach would be the agent doesn't have toor let's say in a chromatic case it was 2000 stories, maybe that translates to 300 files.

When reading to 300 files there, But why wouldn't it have to go through all those thousand files if its job is to categorize them?

Just maybe the-the relative finding of the repository structures already enough to do a good kind of Bye.

Oh, you mean if the... But you're saying like if the agent has access to the index, storybook index JSON... Just a the file name property and using those paths from that one single JSON read, to then figure out hierarchy or something. And compare against the component graph.

Which would make sense and maybe even additional information of which arcs are used may relate to that change, right? So that we have maybe a kind of highly possible bucket of stories and then stories categorized by the component graph.

I don't know. Featured by... I'm not sure.

But then... By semantics. We get once again into a... different scenarios that we might not support, which is like, what if you have a monorepo and then Storybook is an app in the monorepo where all the stories are inside of that isolated app and those stories, they like import things from separate apps in the monorepo.

We could also take the component path in that situation, the story path, but the component path which it imports, maybe that might be more related to the change itself. Yeah.

I like this meticulous AI idea better. I think having some sort of like a, you know, like a paper layer view or something like that, right? Of ways to see the impact of the change and accepting one and therefore accepting everything else would be nice. Yeah.

I think that could be nice. After scrolling once or twice, it was tremendously slow. So you have to think about some virtualization, maybe reuse of iframes so that they don't get destroyed again and again. So maybe you have like, let's imagine your view can contain four iframes, that you have another four items reserved and then actually eight iframes. you programmatically change the eight iframes so that they don't download all the kind of common assets again and again and again.

don't destroy and recreate them all the time. Yeah, I mean, those iFrames could be communicated. They could just be the preview. It's just a preview view of a story. And therefore, they can still receive channel events. And then we can use the channel to change the stories, right? 100%. 100%. So then they have like cached assets between them. Yeah, and I think if we have these eight icons, frames and they Yeah, but there's more things about this review page that need to be accounted for like I don't know a bigger view full screen size kind of thing because Currently you have side-by-side stuff and that looks great for a button.

But what about a more complex component? What about a page? And what about a component that what you changed actually only affected the desktop view of that component, but because of the size of the iframe that you're putting side by side, the container makes it look, render the mobile view, and therefore you actually missed the change. So I think it's a really tough... problem because we're not dealing with snapshots and the snapshots would be then actually referring to the real use case.

of like the actual viewport of which this got affected and it's not the case with this current solution in the page. in the review page. So I'm so happy.

What is the... We release an extended kind of functionality to say, well, if you have BTA, and that could be a great kind of marketing step as well, right? If you have BTA in place and you have a change set, we run BTA in the background, though I have to say something about that. And then we And then as soon as the information from VTA are coming in, we are able to filter down the kind of changes.

in a better way. Yeah, but thenUm, The thing about that is that an agent will be making changes many times, right? And VTA will get stale so quickly. And the changes which we're getting from VTA, they might actually not even relate to the changes people are seeing now in the newly detected stories or something. So that's rather the ultimate then, right? Yeah, I think for this to work well, we need VTA to be, not VTA, but chromatic build, like the single story build thing.

which was never implemented to actually be implemented. And if we have actually like a truly fast workflow, then we could use it. But otherwise, we will be once again promoting VTA as something really slow and hard to use. So that goes into like a negative Good. Yeah, it's just negative feelings towards the product, I think. So I'm so happy we had this chat. It's so much. so much so many details so many things to account for and I don't...

I'm not optimistic about this project when it comes to delivering a final thing that works really well and it's performant and makes a lot of sense because of the incredible amount of complexity and use cases and layers that we need to account for.

Yeah, I think one of your jobs will also be defining well what's the cut what's the difference between the inner loop and the outer If we would be so exact as the algorithm provides us in terms of figuring out which exact stories have changed, we wouldn't need chromatic anymore, more or less. We still needed to not regress on anything in the future. But for the local development workflow, it might be just a good enough solution to ditch even chromatic for smaller teams.

So where's the cut, right?

Very incredibly important question for the business.

And if you define that card, Then we could also define in a more detailed way of what's needed.

But currently it feels like, well, we want to be as accurate as possible, It's like that's just a solvable task without spending too much context and therefore spending too much money or too much agentic time or whatsoever. I think it really feels for me at least that first part of the project being more a research project of how capable an agent would be in scenarios where we change an atomic component and it just leaks in every other and therefore giving the user really a good kind of review tool and I think that categorization of batching related changes is a good way to do so.

No. Um Yeah, my feeling is that It truly makes sense to split this project into two. the review page, which you have a prototype for, making it work well with what we have today. And then the agentic spike slash experimentation, because it's just too much. Yeah. Awesome And this might be a very interesting workflow, like having some of these like in-depth discussions, recording them with the Notion transcript.

And then, Having a final section, let's say this is a podcast, right? At the closing thoughts. would be to define what an agent could do based on the transcript. So we send this transcript to the agent and then we have actual instructions already. Do you want to try that? Yeah.

I feel like...

I did in the last weeks Yeah, but then in the transcript, so it's still going, right? Do you even talk about... the follow-up steps so that you don't even need to tell the agent what to do because the agent already has those follow-up steps. That's the question.

No, not yet. Because it feels to me like basically it's we are talking about the inner loop project but there is an outer loop project which the agent needs to know about and therefore if it doesn't know it needs to ask about it before doing anything the agent needs access to the storable code base so that it knows about the The review page, it needs access to the prototype, which can be either already in the code base or in the PR, I'm not sure.

The agent needs to reason about all of the problems that we discussed, all of the challenges. It needs to create the questions based on the problems at hand, the solution at hand, whether the solutions actually make sense. It needs to split the project into doable things and maybe undoable things. It needs to tell what is an industry issue that it's probably likely we're not going to fix. It needs to say all of the caveats and ask, We are okay with the caveats and document them into questions.

And it needs to structure the questions in a way that it is easy to follow the questions and the flows because we have too many things that we're talking about. It needs to talk about, it needs to analyze the inner loop project pitch and challenge things and mention what actually is doable and what isn't. Am I missing anything No. And that's a great summary. All right, then best of luck, agent, whichever one I am sending this to.
