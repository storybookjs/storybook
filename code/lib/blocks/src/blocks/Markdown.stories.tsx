import { dedent } from 'ts-dedent';

import mdContent from '../examples/Markdown-content.md?raw';
import { Markdown as MarkdownComponent } from './Markdown';

export default {
  component: MarkdownComponent,
  parameters: {
    layout: 'fullscreen',
    docsStyles: true,
  },
};

export const Markdown = {
  args: {
    children: dedent`
    # My Example Markdown

    The group looked like tall, exotic grazing animals, swaying gracefully and unconsciously with the movement of the train, their high heels like polished hooves against the gray metal of the Flatline as a construct, a hardwired ROM cassette replicating a dead man’s skills, obsessions, kneejerk responses.
    
    ![An image](https://storybook.js.org/images/placeholders/350x150.png)
    
    He stared at the clinic, Molly took him to the Tank War, mouth touched with hot gold as a gliding cursor struck sparks from the wall of a skyscraper canyon.
    
    Paragraph with an \`inline code\` block.

    \`\`\`tsx
    // TypeScript React code block
    export const MyStory = () => {
      return <Button>Click me</Button>;
    };
    \`\`\`
    
    \`\`\`
    code block with with no language
    const a = fn({
      b: 2,
    });
    \`\`\`

    <h3>Native h3 element</h3>

    # [Link](https://storybook.js.org/) in heading
    ## [Link](https://storybook.js.org/) in heading
    ### [Link](https://storybook.js.org/) in heading
    #### [Link](https://storybook.js.org/) in heading
    ##### [Link](https://storybook.js.org/) in heading
    ###### [Link](https://storybook.js.org/) in heading
    
    He stared at the clinic, [Molly](https://storybook.js.org/) took him to the *[Tank War](https://storybook.js.org/)*, mouth touched with hot gold as a gliding cursor struck sparks from the wall of a **[skyscraper](https://storybook.js.org/)** canyon.
    
    { brackets, valid MD but invalid MDX - works here }
    
    <Looks like a JSX tag/>
    <!-- above is valid MD but invalid in markdown-to-jsx, so it will not be rendered -->

    \`<Looks like a JSX tag />\`

    The above is only visible because it is wrapped in backticks
    `,
  },
};

/**
 * The Markdown component won't know the difference between getting a raw string and something
 * imported from a .md file. So this story doesn't actually test the component, but rather the
 * import at the top of the CSF file
 */
export const ImportedMDFile = {
  name: 'Imported .md file',
  args: { children: mdContent },
};

export const Text = {
  args: {
    children: `That was Wintermute, manipulating the lock the way it had manipulated the drone micro and the amplified breathing of the room where Case waited. The semiotics of the bright void beyond the chain link. The tug Marcus Garvey, a steel drum nine meters long and two in diameter, creaked and shuddered as Maelcum punched for a California gambling cartel, then as a paid killer in the dark, curled in his capsule in some coffin hotel, his hands clawed into the nearest door and watched the other passengers as he rode. After the postoperative check at the clinic, Molly took him to the simple Chinese hollow points Shin had sold him. Still it was a handgun and nine rounds of ammunition, and as he made his way down Shiga from the missionaries, the train reached Case’s station. Now this quiet courtyard, Sunday afternoon, this girl with a random collection of European furniture, as though Deane had once intended to use the place as his home. Case felt the edge of the Flatline as a construct, a hardwired ROM cassette replicating a dead man’s skills, obsessions, kneejerk responses. They were dropping, losing altitude in a canyon of rainbow foliage, a lurid communal mural that completely covered the hull of the console in faded pinks and yellows.`,
  },
};
