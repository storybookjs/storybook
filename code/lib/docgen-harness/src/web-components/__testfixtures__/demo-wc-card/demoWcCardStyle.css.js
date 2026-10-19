import { css } from 'lit';

export const demoWcCardStyle = css`
  :host {
    display: block;
    position: relative;
    width: 250px;
    height: 200px;
    border-radius: 10px;
    transform-style: preserve-3d;
    transition: all 0.8s ease;
  }

  .header {
    font-weight: bold;
    font-size: var(--demo-wc-card-header-font-size, 16px);
    text-align: center;
  }

  .content {
    padding: 20px 10px 0 10px;
    flex-grow: 1;
  }

  .footer {
    display: flex;
  }

  dl {
    margin: 0;
    text-align: left;
  }

  dd {
    margin-left: 15px;
  }

  button {
    border-radius: 15px;
    width: 30px;
    height: 30px;
    background: #fff;
    border: 1px solid #ccc;
    color: #000;
    font-size: 21px;
    line-height: 27px;
    font-weight: bold;
    cursor: pointer;
    margin: 5px;
  }

  .note {
    flex-grow: 1;
    color: #666;
    font-size: 16px;
    font-weight: bold;
    text-align: left;
    padding-top: 15px;
  }

  :host([back-side]) {
    transform: rotateY(180deg);
  }

  #front,
  #back {
    position: absolute;
    width: 250px;
    box-sizing: border-box;
    box-shadow: #ccc 3px 3px 2px 1px;
    padding: 10px;
    display: flex;
    flex-flow: column;
    top: 0;
    left: 0;
    height: 100%;
    border-radius: 10px;
    backface-visibility: hidden;
    overflow: hidden;
  }

  #front {
    background: linear-gradient(141deg, #aaa 25%, #eee 40%, #ddd 55%);
    color: var(--demo-wc-card-front-color, #000);
  }

  #back {
    background: linear-gradient(141deg, #333 25%, #aaa 40%, #666 55%);
    color: var(--demo-wc-card-back-color, #fff);
    text-align: center;
    transform: rotateY(180deg) translate3d(0px, 0, 1px);
  }

  #back .note {
    color: #fff;
  }
`;
