import Button from './Button.gts';
import './header.css';
import type { TOC } from '@ember/component/template-only';

export interface Signature {
  Args: {
    user?: { name: string };
    onLogin: () => void;
    onLogout: () => void;
    onCreateAccount: () => void;
  };
}

let Logo = <template>
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 32"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g fill="none" fillRule="evenodd">
      <path
        d="M10 0h12a10 10 0 0110 10v12a10 10 0 01-10 10H10A10 10 0 010 22V10A10 10 0 0110 0z"
        fill="#FFF"
      />
      <path
        d="M5.3 10.6l10.4 6v11.1l-10.4-6v-11zm11.4-6.2l9.7 5.5-9.7 5.6V4.4z"
        fill="#555AB9"
      />
      <path
        d="M27.2 10.6v11.2l-10.5 6V16.5l10.5-6zM15.7 4.4v11L6 10l9.7-5.5z"
        fill="#91BAF8"
      />
    </g>
  </svg>
  <h1>Acme</h1>
</template>;

let Header = <template>
  <header>
    <div class="storybook-header">
      <Logo />
      <div>
        {{#if @user}}
          <span class="welcome">Welcome, <b>{{@user.name}}</b>!</span>
          <Button @onClick={{@onLogout}} @size="small" @label="Log out" />
        {{else}}
          <Button @onClick={{@onLogin}} @size="small" @label="Log in" />
          <Button
            @onClick={{@onCreateAccount}}
            @size="small"
            @label="Sign up"
            @primary={{true}}
          />
        {{/if}}
      </div>
    </div>
  </header>
</template> satisfies TOC<Signature>;

export default Header;
