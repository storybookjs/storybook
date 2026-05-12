Right. In terms of the change detection.

Oh, I thought that the idea was not to like get the list of stories. on its own, but like use the tools to find out the affected thing and then have access to the, to the store book index, to have access to the git diff and also access to the module graph and then be able to like, take some better conclusions or something.

Maybe, but I don't see that in the pitch. I mean, maybe that's what he meant. I mean, there was some notion on Slack, I believe, about giving the agents access to the module graph, like the whole thing. I mean we can do that, no problem. In fact, I already have a branch somewhere that basically does that as a JIT depot. And we can do that. No problem But will it be any better than it reversing the file system?

I mean, maybe a little bit more efficient at least but but I don't expect a world of difference there. Anyway, So I'm feeling we already have a pretty good setup to get a list of relevant stories in the agent, right? The agent can figure it out. Right, you've had a conversation with the agents about whatever the changes are if you wanted to make it made a bunch of file changes Storybook reported back with the changed set of stories or the effective stories And based on that, it can give you a list of stories that you should review. All right. Pretty cool. And now...

Yeah, the real product, what this project really is about is then taking that list of stories and handing it over to Storybook somehow, and then Storybook giving you a nice review experience. Visually. The problem starts with passing the list of stories to Storybook because you cannot really do it using URL params because if you've got like 25 stories With each having a story ID, if you try to tack them all onto a URL, it's probably going to be too long.

Oh, for sure. But then we can have like a server state or something like that, and then we can access it.

It's going to be a server state. So there's going to be an endpoint or whatever, like a post endpoint, where you can send like, oh, these are stories I want to review, and it gives you back like an identifier, like a slug or something, like a unique ID, like this is a review ID, for example. Right? And then you give that to the agents. There's also a URL with like storybook, like localhost6006 slash review slash review.

Random UIDU, random options, right? Yeah. you And then the agent will give you that URL of like, oh, here you can check out all the stories that have changed and that you need to review. And from then on, we need some sort of UI To visualize those stories. But at the moment, I don't know what that's going to look like. I mean, I've seen some stuff by Michael Aristad. But that's more like BRT kind of solutions, like side by side, before and after sort of thing.

Right. I'm not even sure what it... There's, I think, like one bullet point in the pitch that says... you want a before and after. Right? So I feel like it is implicitly or semi-explicitly part of this project But maybe, maybe not. I'm not so sure. What's the concept there? Is there also going to be like an overview page with like thumbnails of every story or like a list that you can scroll through?

At the moment, I don't know. I need to verify with Michael and Michael what this is going to look like. Visually? Right. But, you know, I'm sure we can...

figured it out, but those are the unknowns I have right now.

And then if we do Say, okay, we want to have a side-by-side view before and after. What's the before? Like, what is the baseline then? We're going to need to figure out the baseline and the The thing we settled on with change detection is that the baselineWell, it's essentially the baseline is whatever the state of your system was when you started Storybook first time, right? So when you start Storybook Server, we take like a snapshot shots that date and that's what was essentially your baseline.

We can do that, but I already know from feedback that that is, well, not great. Because? Well... For one. You restart your storybook all the time. As soon as you restart your storybook, your baseline changes. I see. We sort of semi-solved that problem. In change detection by storing the snapshot on disk, Uh... And in the cash? And if you restart Storybook, read from the couch. And we only store to cash it At the moment of starting Storybook, you have a clean git.

So if there's no git changes yet, you have a create commit. and you then start storybook, we persist that into no controls cash. Like, oh, this is a clean snapshot from when you started work on this branch. And from then on, you can actually restart the store group and it's always fine, right? That'll work. But I feel like that is Also anotherGreat. I see So I'm, and there's been some discussion of like, okay, now I want to actually like have my remote French. As the baseline?

or My main branch.

I see.

My base branch.

But then we're kind of rebuilding Chromatic.

Right? Now the question is, okay, what's the baseline going to be? It's okay. I can very much get behind saying, okay, a git commit hash You can configure as a baseline. And then wherever that commit lives, I don't care if it's this branch or another branch. It's a commit. I see. But if that's something that we want to pursue, like saying, okay, this git commit is a baseline, well, we're going to have to take a snapshot of that commit then. How are we going to do that?

Because we're gonna have to put your local git repo I don't think that's going to be good.

It's going to be very complicated.

Exactly. persisted somewhere and then switched back to your original place in Git. Right? And then start to circle again, so we'll have the baseline.

It doesn't seem very feasible because at some point you're gonna have like... If you can change between commits you need to rebuild the whole application and maybe you have like... you just made a migration and you need a clean install state you need a clean build state which doesn't relate to your current build and install state and that's gonna be very complicated and this is the thing that we should just let the cloud and chromatic do, right?

Yes.

So, um, I feel like people have ideas and desires that aren't feasible without leaning into chromatic yeah i agree um And we need to get that Sort it.

See you later. So let me tell you what I was thinking about. So last writing I had a call with Valentin because I wanted to hear more about the the experimentation he did for the before and after thing. Uh-huh. And then I took a look into the pitch And I was starting to wonder about The action like what exactly is this pitch and how feasible this is? because you know Michael has Come up with a lot of different ideas and stuff. It doesn't mean that they're all I doable.

So I'm trying to figure out how doable this is and if it is doable. What's the caveat? Like what are the things that we need to be okay with not having, you know? So What I wanted to do, what I wanted or want, I wanted to check with you, is to kind of like do a small... research to figure out the unknowns to just kind of like lay out a bunch of questions, so that we can discuss better before we start the project, right?

Because those things are gonna basically help us shape the deliverables and the scope of the project, but also set up expectations. Because for instance, If you... First of all, Valentin said that the prototype isn't isn't perfect and therefore we need to work on it. And he also mentioned that there are some use cases where the performance is pretty bad. So What is the actual expected UX from the user side?

Like, does the user expect things to be just incredibly fast. Currently, we only have this deterministic layer where the change detection is the only thing that takes time. But then later, we're going to have that plus an agent that is going to both consume tokens, output tokens, and also take time to do whatever it is supposed to be doing. So are those things even like, if we were to reach a deliverable at the end of the project, is that actually like great?

That's the kind of thing I wanted to like just take a closer look and figure out. The other thing I'm wondering is also like the... The things which we are assuming already exist, but they actually exist like is there any MCP tool that already does the things we need or do we actually need to work on the MCP to implement something extra on it? Are there other things that we need to figure out that turns out that we have a way more work, you know?

And I also wanted to figure out what is the shape of the deliverables because for instance, I see two things, the UI for the review changes page, which on its own has so many questions. And then the other part, which is the agentic part. But also the connection between them like is 100% of what we're building going to be agentic based and therefore not of any use to let's say normal users. or not and and then figure out what to do.

Because even if we just forgot about entirely about the AI stuff, just want to build the review changes UI. That in itself is complicated if you don't have VRT. Because how do you do the before view and the after view if you have like a limited space in the UI? You'd put them in an iframe side by side, What if the component you're changing Well, first of all, The changes you made might not be visual and therefore you have nothing to show. So that's the first thing we need to think about. Two.

you might be only changing a CSS. And maybe that CSS somehow is in tracked or something. And that is a visual change. You need to be sure. 3. You might have a lot of change that is going to take a lot of time to check what's going on. Turns out that change has nothing to do with any visual things at all. Four. How do you even want to fine-grain the change detection to a particular story without having access to code coverage?

Because like if you have a story that relates to a component that is like a bunch of branches like if if statements and Only one if statement gets triggered by one story out of a hundred stories. How do we even show like that that is the one particular story that affected that code path? Right? So there's like all these questions, but also If you make a change in a page component, And then you show that in before and after in like a very small iframe.

That's like, that doesn't work. No. If you make a change that only affects the desktop view of something, but then in the iframe which you're showing, the container size becomes mobile, There's so many questions, right?

Yeah, the answer, there's answers there.

VRT. Well...

Yeah, but one thing is of course you can configure viewports for your story and render at that viewport so if you have something that's specific to mobile you should configure a viewport so that you are certain that you will see what you want to see.

But then if you have that viewport in the UI changes page which is taking, I don't know, 70% of the space, right? And then you have half.

Well, I get the feel that... without having a Diff pew?

Like the green overlay thing? The PRT or work you show do things side by side.

Unless it's like super obvious, But most of the time you won't see it, right? It's a little nuanced thing.

You can shift a couple pixels, whatever.

Unless you can like replace.

And exactly. So I think what we will do is instead of doing side by side, we'll just have the one up. and you can switch between the baseline and the latest. And that will work and you will have the full size of the preview available. So that should technically work. Work most of the time.

Exceptions are where it exists. So I feel like that's the solution that we might end up going to or gravitating towards. If we even do... like comparison at all.

Maybe we say we're not going to do a baseline. Hmm.

but instead of giving you before and after we will give you some sort of enhanced review experience of like it's basically a different way to browse your stories right because instead of giving you the sidebar with everything there or maybe filtered by like a tag instead of giving you that we'll give you I don't know, like a side-scrolling thing. Right? With a button, in that case, next, next, next, next. Right?

And that will just iterate through the subset of stories that the agent determines or whatever system determines.

of like okay i'm reviewing this set of stories and you can just go next next next next maybe Uh, Like you could maybe like leave a comment or whatever or something if that's something that we want to do. And then you don't even have like a before. You only have the after.

Which is maybe okay. Okay, because you might have a picture in mind of where you want to go. And you may not even need the before.

to know whether or not something looks good.

Right. Yeah, I think that makes more sense because the thing is, If you don't do VRT, then you have a lot of problems. You have like play functions getting executed and therefore if you put all of the stories with like different iframes in the same screen, the play functions might affect one another. You have the viewports problems, you might even have like a system theme kind of situation where you want to render something in dark mode or light mode and then whatever doesn't render as expected.

There's a bunch of these like different artifacts that can be problematic. And if you don't do image, If you don't do VRT, then that is a problem, right? But if we were to go on the VRT route, then we're also kind of like maybe hurting the project because... the project node, the product, because people are going to be like, oh, this is so good that I don't want to use chromatic or they will use chromatic less.

And if we were to like hook in--VRT is explicitly not part, like in the pitch it says what's out of scope explicitly is VRT. Yeah, exactly. Definitely not doing VRT, but you could say that having a baseline and latest, side by side or on top of each other with like a toggle Could be considered VRT.

It's just not doing a visual visual. But it's still a visual comparison between something. I would be okay to have like, okay, it's like a poor man's VRT.

It doesn't get clever. It just like... Allows you to see versus new. Which is convenient. And maybe you could say, OK, it needs to be like a hosted storybook. You can only point it at an other instance, like composition.

I have.

with a ref or something. You can say like, oh, I want to compare against the previous version of my book. Right. We could do that.

I feel that's better than trying to do that on your local machine.

But-But then how feasible would that be? You mean like when you run locally somehow it makes a build and serves that statically?

I mean, no, no. I mean... Not. You would have to do that manually. But in this review flow, we give you the option to provide us with a URL to a listed store group.

I see. Yeah. Although in that flow. It would only work well if Because you can imagine someone in the agent accession for like an hour or something, and then they're making changes, right? And then maybe the first one they're gonna be like, okay, sure, it's comparing to something which is deployed somewhere. But from there on, it's gonna be wrong in a way, right? because they want to compare the previous iteration with the next iteration and not with whatever was deployed?

Yeah. And therefore they would need to deploy once again and then wait for that to be over and then change the URL again. Ooi.

I mean, I suppose we could do even that. But this is an interesting concept.

Like, we could have like a CLI command that says like, or whatever, or just MBF store build, I suppose. Store build and it builds a static version on your web machine. And then from then on, if there is such a store book static thing, It'll use that as baseline. That's fair. I mean, maybe we should just say like if there's a store book static folder, We use it as a baseline. And then it's up to you to make sure that that thing exists and is built in the right way and whatever.

That's then up to the end user or the agent for that matter.

Yeah, maybe. What I'm also thinking is that there will be similar problems than Chromatic, which is like, sure, we built the whole thing and it looks great and we now present a thousand things. changes for people to look at, it would be better to actually let the agent cluster and categorize the changes, right?

Clustering is over, that's interesting.

Uh, I... That's a good thought. We need to dig a little deeper there.

Because... It's one thing for the agent to come up with an ordered list of stories, but another thing for an agent to come up with a clustered, like grouped list. or like chapters or whatever. But there is some notion in this pitch about zooming out. Ideally, you have a review flow where you focus first on the Media to the effect of stories, right? Change a button components and a button stories. The first thing you have to review, is that right?

You zoom out one level, of like, oh no, I see now header components and some like search form components that has this button, right? And then you zoom out further where you see pages and whatnot, right?

That workflow is pretty cool.

Basically up to the agent to come up with yeah Yes And maybe it comes up with a named Groupings? Yeah.

It's like zoom levels. Yeah. We could do that. That's interesting content.

I'm not sure how that would work. So if you don't mind, I can do some or just some research to figure some stuff out. Maybe try some little Evolve thing where we can send an agent to do the clustering and then we can see how that behaves. And hopefully that helps us discuss more about the project. And then I feel like we should just write down some questions on Notion similar to how Valentin did. so that we are fully aligned as the project starts instead of like my project where...

One of the things I want to do this week is create a new Notion doc with a technical...

design doc for this project. So all of these questions answered and what does it look like? Not like a product focused pitch, More technical design implementation doc, which we then ideally can just one-on-one paste into an LLM to build the whole thing, but you know what I mean. But that's aYeah, but I feel like we need alignment on the product and UX and the feasibility of things before we even get to it, which is why I really feel like doing a little bit of research and then presenting that and talking about it before the project starts would be nice.
