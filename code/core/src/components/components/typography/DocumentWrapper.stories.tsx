import React from 'react';

import { DocumentWrapper } from './DocumentWrapper';

export default {
  component: DocumentWrapper,
  decorators: [(storyFn: any) => <div style={{ width: '600px' }}>{storyFn()}</div>],
};

export const WithDOM = () => (
  <DocumentWrapper>
    <h1>h1 Heading</h1>
    <h2>h2 Heading</h2>
    <h3>h3 Heading</h3>
    <h4>h4 Heading</h4>
    <h5>h5 Heading</h5>
    <h6>h6 Heading</h6>
    <h2>Typographic replacements</h2>
    <p>Enable typographer option to see result.</p>
    <p>© © ® ® ™ ™ § § ±</p>
    <p>test… test… test… test?.. test!..</p>
    <p>!!! ??? , – —</p>
    <p>“Smartypants, double quotes” and ‘single quotes’</p>
    <h2>Emphasis</h2>
    <p>
      <strong>This is bold text</strong>
    </p>
    <p>
      <strong>This is bold text</strong>
    </p>
    <p>
      <em>This is italic text</em>
    </p>
    <p>
      <em>This is italic text</em>
    </p>
    <p>
      <em>
        <strong>This is bold italic text</strong>
      </em>
    </p>
    <p>
      <s>Strikethrough</s>
    </p>
    <h2>Blockquotes</h2>
    <blockquote>
      <p>Blockquotes can also be nested…</p>
      <blockquote>
        <p>…by using additional greater-than signs right next to each other…</p>
        <blockquote>
          <p>…or with spaces between arrows.</p>
        </blockquote>
      </blockquote>
    </blockquote>
    <h2>Lists</h2>
    <p>Unordered</p>
    <ul>
      <li>
        Create a list by starting a line with <code>+</code>, <code>-</code>, or <code>*</code>
      </li>
      <li>
        Sub-lists are made by indenting 2 spaces:
        <ul>
          <li>
            Marker character change forces new list start:
            <ul>
              <li>Ac tristique libero volutpat at</li>
            </ul>
            <ul>
              <li>Facilisis in pretium nisl aliquet</li>
            </ul>
            <ul>
              <li>Nulla volutpat aliquam velit</li>
            </ul>
          </li>
        </ul>
      </li>
      <li>Very easy!</li>
    </ul>
    <p>Ordered</p>
    <ol>
      <li>
        <p>Lorem ipsum dolor sit amet</p>
      </li>
      <li>
        <p>Consectetur adipiscing elit</p>
      </li>
      <li>
        <p>Integer molestie lorem at massa</p>
      </li>
      <li>
        <p>You can use sequential numbers…</p>
      </li>
      <li>
        <p>
          …or keep all the numbers as <code>1.</code>
        </p>
      </li>
    </ol>
    <p>Start numbering with offset:</p>
    <ol start={57}>
      <li>foo</li>
      <li>bar</li>
    </ol>
    <h2>Horizontal Rule</h2>
    <hr />
    <h2>Tables</h2>
    <table>
      <thead>
        <tr>
          <th>Option</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>data</td>
          <td>path to data files to supply the data that will be passed into templates.</td>
        </tr>
        <tr>
          <td>engine</td>
          <td>engine to be used for processing templates. Handlebars is the default.</td>
        </tr>
        <tr>
          <td>ext</td>
          <td>extension to be used for dest files.</td>
        </tr>
      </tbody>
    </table>
    <p>Right aligned columns</p>
    <table>
      <thead>
        <tr>
          <th style={{ textAlign: 'right' }}>Option</th>
          <th style={{ textAlign: 'right' }}>Description</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={{ textAlign: 'right' }}>data</td>
          <td style={{ textAlign: 'right' }}>
            path to data files to supply the data that will be passed into templates.
          </td>
        </tr>
        <tr>
          <td style={{ textAlign: 'right' }}>engine</td>
          <td style={{ textAlign: 'right' }}>
            engine to be used for processing templates. Handlebars is the default.
          </td>
        </tr>
        <tr>
          <td style={{ textAlign: 'right' }}>ext</td>
          <td style={{ textAlign: 'right' }}>extension to be used for dest files.</td>
        </tr>
      </tbody>
    </table>
    <h2>Links</h2>
    <p>
      <a href="http://dev.nodeca.com">link text</a>
    </p>
    <p>
      <a href="http://nodeca.github.io/pica/demo/" title="title text!">
        link with title
      </a>
    </p>
    <p>
      Autoconverted link <a href="https://github.com/nodeca/pica">https://github.com/nodeca/pica</a>
      &nbsp;(enable linkify to see)
    </p>
    <h2>Images</h2>
    <p>
      <img src="https://octodex.github.com/images/minion.png" alt="Minion" />
      <img
        src="https://octodex.github.com/images/stormtroopocat.jpg"
        alt="Stormtroopocat"
        title="The Stormtroopocat"
      />
    </p>
  </DocumentWrapper>
);
