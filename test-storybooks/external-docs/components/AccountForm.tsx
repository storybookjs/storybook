import { keyframes, styled } from 'storybook/internal/theming';
import {
  ErrorMessage,
  Field as FormikInput,
  Form as FormikForm,
  Formik,
  FormikProps,
} from 'formik';
import React, { FC, HTMLAttributes, useCallback, useState } from 'react';
import { Icons, WithTooltip } from 'storybook/internal/components';

const errorMap = {
  email: {
    required: {
      normal: 'Please enter your email address',
      tooltip:
        'We do require an email address and a password as a minimum in order to be able to create an account for you to log in with',
    },
    format: {
      normal: 'Please enter a correctly formatted email address',
      tooltip:
        'Your email address is formatted incorrectly and is not correct - please double check for misspelling',
    },
  },
  password: {
    required: {
      normal: 'Please enter a password',
      tooltip: 'A password is required to create an account',
    },
    length: {
      normal: 'Please enter a password of minimum 6 characters',
      tooltip:
        'For security reasons we enforce a password length of minimum 6 characters - but have no other requirements',
    },
  },
  verifiedPassword: {
    required: {
      normal: 'Please verify your password',
      tooltip:
        'Verification of your password is required to ensure no errors in the spelling of the password',
    },
    match: {
      normal: 'Your passwords do not match',
      tooltip:
        'Your verification password has to match your password to make sure you have not misspelled',
    },
  },
};

// https://emailregex.com/
const email99RegExp = new RegExp(
  // eslint-disable-next-line no-useless-escape
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
);

export interface AccountFormResponse {
  success: boolean;
}

export interface AccountFormValues {
  email: string;
  password: string;
}

interface FormValues extends AccountFormValues {
  verifiedPassword: string;
}

interface FormErrors {
  email?: string;
  emailTooltip?: string;
  password?: string;
  passwordTooltip?: string;
  verifiedPassword?: string;
  verifiedPasswordTooltip?: string;
}

export type AccountFormProps = {
  passwordVerification?: boolean;
  onSubmit?: (values: AccountFormValues) => void;
  onTransactionStart?: (values: AccountFormValues) => void;
  onTransactionEnd?: (values: AccountFormResponse) => void;
};

export const AccountForm: FC<AccountFormProps> = ({
  passwordVerification,
  onSubmit,
  onTransactionStart,
  onTransactionEnd,
}) => {
  const [state, setState] = useState({
    transacting: false,
    transactionSuccess: false,
    transactionFailure: false,
  });

  const handleFormSubmit = useCallback(
    async ({ email, password }: FormValues, { setSubmitting, resetForm }) => {
      if (onSubmit) {
        onSubmit({ email, password });
      }

      if (onTransactionStart) {
        onTransactionStart({ email, password });
      }

      setSubmitting(true);

      setState({
        ...state,
        transacting: true,
      });

      await new Promise((r) => setTimeout(r, 2100));

      const success = Math.random() < 1;

      if (onTransactionEnd) {
        onTransactionEnd({ success });
      }

      setSubmitting(false);
      resetForm({ values: { email: '', password: '', verifiedPassword: '' } });

      setState({
        ...state,
        transacting: false,
        transactionSuccess: success === true,
        transactionFailure: success === false,
      });
    },
    [setState, onTransactionEnd, onTransactionStart]
  );

  return (
    <Wrapper>
      <Brand>
        <Logo
          aria-label="Storybook Logo"
          viewBox="0 0 64 64"
          transacting={state.transacting}
          role="img"
        >
          <title>Storybook icon</title>
          <g id="Artboard" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
            <path
              d="M8.04798541,58.7875918 L6.07908839,6.32540407 C6.01406344,4.5927838 7.34257463,3.12440831 9.07303814,3.01625434 L53.6958037,0.227331489 C55.457209,0.117243658 56.974354,1.45590096 57.0844418,3.21730626 C57.0885895,3.28366922 57.0906648,3.35014546 57.0906648,3.41663791 L57.0906648,60.5834697 C57.0906648,62.3483119 55.6599776,63.7789992 53.8951354,63.7789992 C53.847325,63.7789992 53.7995207,63.7779262 53.7517585,63.775781 L11.0978899,61.8600599 C9.43669044,61.7854501 8.11034889,60.4492961 8.04798541,58.7875918 Z"
              id="path-1"
              fill="#FF4785"
              fillRule="nonzero"
            />
            <path
              d="M35.9095005,24.1768792 C35.9095005,25.420127 44.2838488,24.8242707 45.4080313,23.9509748 C45.4080313,15.4847538 40.8652557,11.0358878 32.5466666,11.0358878 C24.2280775,11.0358878 19.5673077,15.553972 19.5673077,22.3311017 C19.5673077,34.1346028 35.4965208,34.3605071 35.4965208,40.7987804 C35.4965208,42.606015 34.6115646,43.6790606 32.6646607,43.6790606 C30.127786,43.6790606 29.1248356,42.3834613 29.2428298,37.9783269 C29.2428298,37.0226907 19.5673077,36.7247626 19.2723223,37.9783269 C18.5211693,48.6535354 25.1720308,51.7326752 32.7826549,51.7326752 C40.1572906,51.7326752 45.939005,47.8018145 45.939005,40.6858282 C45.939005,28.035186 29.7738035,28.3740425 29.7738035,22.1051974 C29.7738035,19.5637737 31.6617103,19.2249173 32.7826549,19.2249173 C33.9625966,19.2249173 36.0864917,19.4328883 35.9095005,24.1768792 Z"
              id="path9_fill-path"
              fill="#FFFFFF"
              fillRule="nonzero"
            />
            <path
              d="M44.0461638,0.830433986 L50.1874092,0.446606143 L50.443532,7.7810017 C50.4527198,8.04410717 50.2468789,8.26484453 49.9837734,8.27403237 C49.871115,8.27796649 49.7607078,8.24184808 49.6721567,8.17209069 L47.3089847,6.3104681 L44.5110468,8.43287463 C44.3012992,8.591981 44.0022839,8.55092814 43.8431776,8.34118051 C43.7762017,8.25288717 43.742082,8.14401677 43.7466857,8.03329059 L44.0461638,0.830433986 Z"
              id="Path"
              fill="#FFFFFF"
            />
          </g>
        </Logo>
        <Title aria-label="Storybook" viewBox="0 0 200 40" role="img">
          <title>Storybook</title>
          <g fill="none" fillRule="evenodd">
            <path
              d="M53.3 31.7c-1.7 0-3.4-.3-5-.7-1.5-.5-2.8-1.1-3.9-2l1.6-3.5c2.2 1.5 4.6 2.3 7.3 2.3 1.5 0 2.5-.2 3.3-.7.7-.5 1.1-1 1.1-1.9 0-.7-.3-1.3-1-1.7s-2-.8-3.7-1.2c-2-.4-3.6-.9-4.8-1.5-1.1-.5-2-1.2-2.6-2-.5-1-.8-2-.8-3.2 0-1.4.4-2.6 1.2-3.6.7-1.1 1.8-2 3.2-2.6 1.3-.6 2.9-.9 4.7-.9 1.6 0 3.1.3 4.6.7 1.5.5 2.7 1.1 3.5 2l-1.6 3.5c-2-1.5-4.2-2.3-6.5-2.3-1.3 0-2.3.2-3 .8-.8.5-1.2 1.1-1.2 2 0 .5.2 1 .5 1.3.2.3.7.6 1.4.9l2.9.8c2.9.6 5 1.4 6.2 2.4a5 5 0 0 1 2 4.2 6 6 0 0 1-2.5 5c-1.7 1.2-4 1.9-7 1.9zm21-3.6l1.4-.1-.2 3.5-1.9.1c-2.4 0-4.1-.5-5.2-1.5-1.1-1-1.6-2.7-1.6-4.8v-6h-3v-3.6h3V11h4.8v4.6h4v3.6h-4v6c0 1.8.9 2.8 2.6 2.8zm11.1 3.5c-1.6 0-3-.3-4.3-1a7 7 0 0 1-3-2.8c-.6-1.3-1-2.7-1-4.4 0-1.6.4-3 1-4.3a7 7 0 0 1 3-2.8c1.2-.7 2.7-1 4.3-1 1.7 0 3.2.3 4.4 1a7 7 0 0 1 3 2.8c.6 1.2 1 2.7 1 4.3 0 1.7-.4 3.1-1 4.4a7 7 0 0 1-3 2.8c-1.2.7-2.7 1-4.4 1zm0-3.6c2.4 0 3.6-1.6 3.6-4.6 0-1.5-.3-2.6-1-3.4a3.2 3.2 0 0 0-2.6-1c-2.3 0-3.5 1.4-3.5 4.4 0 3 1.2 4.6 3.5 4.6zm21.7-8.8l-2.7.3c-1.3.2-2.3.5-2.8 1.2-.6.6-.9 1.4-.9 2.5v8.2H96V15.7h4.6v2.6c.8-1.8 2.5-2.8 5-3h1.3l.3 4zm14-3.5h4.8L116.4 37h-4.9l3-6.6-6.4-14.8h5l4 10 4-10zm16-.4c1.4 0 2.6.3 3.6 1 1 .6 1.9 1.6 2.5 2.8.6 1.2.9 2.7.9 4.3 0 1.6-.3 3-1 4.3a6.9 6.9 0 0 1-2.4 2.9c-1 .7-2.2 1-3.6 1-1 0-2-.2-3-.7-.8-.4-1.5-1-2-1.9v2.4h-4.7V8.8h4.8v9c.5-.8 1.2-1.4 2-1.9.9-.4 1.8-.6 3-.6zM135.7 28c1.1 0 2-.4 2.6-1.2.6-.8 1-2 1-3.4 0-1.5-.4-2.5-1-3.3s-1.5-1.1-2.6-1.1-2 .3-2.6 1.1c-.6.8-1 2-1 3.3 0 1.5.4 2.6 1 3.4.6.8 1.5 1.2 2.6 1.2zm18.9 3.6c-1.7 0-3.2-.3-4.4-1a7 7 0 0 1-3-2.8c-.6-1.3-1-2.7-1-4.4 0-1.6.4-3 1-4.3a7 7 0 0 1 3-2.8c1.2-.7 2.7-1 4.4-1 1.6 0 3 .3 4.3 1a7 7 0 0 1 3 2.8c.6 1.2 1 2.7 1 4.3 0 1.7-.4 3.1-1 4.4a7 7 0 0 1-3 2.8c-1.2.7-2.7 1-4.3 1zm0-3.6c2.3 0 3.5-1.6 3.5-4.6 0-1.5-.3-2.6-1-3.4a3.2 3.2 0 0 0-2.5-1c-2.4 0-3.6 1.4-3.6 4.4 0 3 1.2 4.6 3.6 4.6zm18 3.6c-1.7 0-3.2-.3-4.4-1a7 7 0 0 1-3-2.8c-.6-1.3-1-2.7-1-4.4 0-1.6.4-3 1-4.3a7 7 0 0 1 3-2.8c1.2-.7 2.7-1 4.4-1 1.6 0 3 .3 4.4 1a7 7 0 0 1 2.9 2.8c.6 1.2 1 2.7 1 4.3 0 1.7-.4 3.1-1 4.4a7 7 0 0 1-3 2.8c-1.2.7-2.7 1-4.3 1zm0-3.6c2.3 0 3.5-1.6 3.5-4.6 0-1.5-.3-2.6-1-3.4a3.2 3.2 0 0 0-2.5-1c-2.4 0-3.6 1.4-3.6 4.4 0 3 1.2 4.6 3.6 4.6zm27.4 3.4h-6l-6-7v7h-4.8V8.8h4.9v13.6l5.8-6.7h5.7l-6.6 7.5 7 8.2z"
              fill="currentColor"
            />
          </g>
        </Title>
      </Brand>
      {!state.transactionSuccess && !state.transactionFailure && (
        <Introduction>Create an account to join the Storybook community</Introduction>
      )}
      <Content>
        {state.transactionSuccess && !state.transactionFailure && (
          <Presentation>
            <p>
              Everything is perfect. Your account is ready and we should probably get you started!
            </p>
            <p>So why don't you get started then?</p>
            <Submit
              dirty
              onClick={() => {
                setState({
                  transacting: false,
                  transactionSuccess: false,
                  transactionFailure: false,
                });
              }}
            >
              Go back
            </Submit>
          </Presentation>
        )}
        {state.transactionFailure && !state.transactionSuccess && (
          <Presentation>
            <p>What a mess, this API is not working</p>
            <p>
              Someone should probably have a stern talking to about this, but it won't be me - coz
              I'm gonna head out into the nice weather
            </p>
            <Submit
              dirty
              onClick={() => {
                setState({
                  transacting: false,
                  transactionSuccess: false,
                  transactionFailure: false,
                });
              }}
            >
              Go back
            </Submit>
          </Presentation>
        )}
        {!state.transactionSuccess && !state.transactionFailure && (
          <Formik
            initialValues={{ email: '', password: '', verifiedPassword: '' }}
            validateOnBlur={false}
            validateOnChange={false}
            onSubmit={handleFormSubmit}
            validate={({ email, password, verifiedPassword }) => {
              const errors: FormErrors = {};

              if (!email) {
                errors.email = errorMap.email.required.normal;
                errors.emailTooltip = errorMap.email.required.tooltip;
              } else {
                const validEmail = email.match(email99RegExp);

                if (validEmail === null) {
                  errors.email = errorMap.email.format.normal;
                  errors.emailTooltip = errorMap.email.format.tooltip;
                }
              }

              if (!password) {
                errors.password = errorMap.password.required.normal;
                errors.passwordTooltip = errorMap.password.required.tooltip;
              } else if (password.length < 6) {
                errors.password = errorMap.password.length.normal;
                errors.passwordTooltip = errorMap.password.length.tooltip;
              }

              if (passwordVerification && !verifiedPassword) {
                errors.verifiedPassword = errorMap.verifiedPassword.required.normal;
                errors.verifiedPasswordTooltip = errorMap.verifiedPassword.required.tooltip;
              } else if (passwordVerification && password !== verifiedPassword) {
                errors.verifiedPassword = errorMap.verifiedPassword.match.normal;
                errors.verifiedPasswordTooltip = errorMap.verifiedPassword.match.tooltip;
              }

              return errors;
            }}
          >
            {({ errors: _errors, isSubmitting, dirty }: FormikProps<FormValues>) => {
              const errors = _errors as FormErrors;

              return (
                <Form noValidate aria-disabled={isSubmitting ? 'true' : 'false'}>
                  <FieldWrapper>
                    <Label htmlFor="email">Email</Label>
                    <FormikInput id="email" name="email">
                      {({ field }: { field: HTMLAttributes<HTMLInputElement> }) => (
                        <>
                          <Input
                            data-testid="email"
                            aria-required="true"
                            aria-disabled={isSubmitting ? 'true' : 'false'}
                            disabled={isSubmitting}
                            type="email"
                            aria-invalid={errors.email ? 'true' : 'false'}
                            {...field}
                          />
                          {errors.email && (
                            <WithTooltip
                              tooltip={<ErrorTooltip>{errors.emailTooltip}</ErrorTooltip>}
                            >
                              <ErrorWrapper>
                                <ErrorIcon icon="question" height={14} />
                                <Error name="email" component="div" />
                              </ErrorWrapper>
                            </WithTooltip>
                          )}
                        </>
                      )}
                    </FormikInput>
                  </FieldWrapper>
                  <FieldWrapper>
                    <Label htmlFor="password">Password</Label>
                    <FormikInput id="password" name="password">
                      {({ field }: { field: HTMLAttributes<HTMLInputElement> }) => (
                        <Input
                          data-testid="password1"
                          aria-required="true"
                          aria-disabled={isSubmitting ? 'true' : 'false'}
                          aria-invalid={errors.password ? 'true' : 'false'}
                          type="password"
                          disabled={isSubmitting}
                          {...field}
                        />
                      )}
                    </FormikInput>
                    {errors.password && (
                      <WithTooltip tooltip={<ErrorTooltip>{errors.passwordTooltip}</ErrorTooltip>}>
                        <ErrorWrapper data-testid="password-error-info">
                          <ErrorIcon icon="question" height={14} />
                          <Error name="password" component="div" />
                        </ErrorWrapper>
                      </WithTooltip>
                    )}
                  </FieldWrapper>
                  {passwordVerification && (
                    <FieldWrapper>
                      <Label htmlFor="verifiedPassword">Verify Password</Label>
                      <FormikInput id="verifiedPassword" name="verifiedPassword">
                        {({ field }: { field: HTMLAttributes<HTMLInputElement> }) => (
                          <Input
                            data-testid="password2"
                            aria-required="true"
                            aria-disabled={isSubmitting ? 'true' : 'false'}
                            aria-invalid={errors.verifiedPassword ? 'true' : 'false'}
                            type="password"
                            disabled={isSubmitting}
                            {...field}
                          />
                        )}
                      </FormikInput>
                      {errors.verifiedPassword && (
                        <WithTooltip
                          tooltip={<ErrorTooltip>{errors.verifiedPasswordTooltip}</ErrorTooltip>}
                        >
                          <ErrorWrapper>
                            <ErrorIcon icon="question" height={14} />
                            <Error name="verifiedPassword" component="div" />
                          </ErrorWrapper>
                        </WithTooltip>
                      )}
                    </FieldWrapper>
                  )}
                  <Actions>
                    <Submit
                      data-testid="submit"
                      aria-disabled={isSubmitting || !dirty ? 'true' : 'false'}
                      disabled={isSubmitting || !dirty}
                      dirty={dirty}
                      type="submit"
                    >
                      Create Account
                    </Submit>
                    <Reset
                      aria-disabled={isSubmitting ? 'true' : 'false'}
                      disabled={isSubmitting}
                      type="reset"
                    >
                      Reset
                    </Reset>
                  </Actions>
                </Form>
              );
            }}
          </Formik>
        )}
      </Content>
    </Wrapper>
  );
};

const Wrapper = styled.section(({ theme }) => ({
  fontFamily: theme.typography.fonts.base,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: 450,
  padding: 32,
  backgroundColor: theme.background.content,
  borderRadius: 7,
}));

const Brand = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const Title = styled.svg({
  height: 40,
  zIndex: 1,
  left: -32,
  position: 'relative',
});

const logoAnimation = keyframes({
  '0': {
    transform: 'rotateY(0deg)',
    transformOrigin: '50% 5% 0',
  },
  '100%': {
    transform: 'rotateY(360deg)',
    transformOrigin: '50% 5% 0',
  },
});

interface LogoProps {
  transacting: boolean;
}

const Logo = styled.svg<LogoProps>(
  ({ transacting }) =>
    transacting && {
      animation: `${logoAnimation} 1250ms both infinite`,
    },
  { height: 40, zIndex: 10, marginLeft: 32 }
);

const Introduction = styled.p({
  marginTop: 20,
  textAlign: 'center',
});

const Content = styled.div({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  width: 350,
  minHeight: 189,
  marginTop: 8,
});

const Presentation = styled.div({
  textAlign: 'center',
});

const Form = styled(FormikForm)({
  width: '100%',
  alignSelf: 'flex-start',
  '&[aria-disabled="true"]': {
    opacity: 0.6,
  },
});

const FieldWrapper = styled.div({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'stretch',
  marginBottom: 10,
});

const Label = styled.label({
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 6,
});

const Input = styled.input(({ theme }) => ({
  fontSize: 14,
  color: theme.color.defaultText,
  padding: '10px 15px',
  borderRadius: 4,
  appearance: 'none',
  outline: 'none',
  border: '0 none',
  boxShadow: 'rgb(0 0 0 / 10%) 0px 0px 0px 1px inset',
  '&:focus': {
    boxShadow: 'rgb(30 167 253) 0px 0px 0px 1px inset',
  },
  '&:active': {
    boxShadow: 'rgb(30 167 253) 0px 0px 0px 1px inset',
  },
  '&[aria-invalid="true"]': {
    boxShadow: 'rgb(255 68 0) 0px 0px 0px 1px inset',
  },
}));

const ErrorWrapper = styled.div({
  display: 'flex',
  alignItems: 'flex-start',
  fontSize: 11,
  marginTop: 6,
  cursor: 'help',
});

const ErrorIcon = styled(Icons)(({ theme }) => ({
  fill: theme.color.defaultText,
  opacity: 0.8,
  marginRight: 6,
  marginLeft: 2,
  marginTop: 1,
}));

const ErrorTooltip = styled.div(({ theme }) => ({
  fontFamily: theme.typography.fonts.base,
  fontSize: 13,
  padding: 8,
  maxWidth: 350,
}));

const Actions = styled.div({
  alignSelf: 'stretch',
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: 24,
});

const Error = styled(ErrorMessage)({});

interface ButtonProps {
  dirty?: boolean;
}

const Button = styled.button<ButtonProps>({
  backgroundColor: 'transparent',
  border: '0 none',
  outline: 'none',
  appearance: 'none',
  fontWeight: 500,
  fontSize: 12,
  flexBasis: '50%',
  cursor: 'pointer',
  padding: '11px 16px',
  borderRadius: 4,
  textTransform: 'uppercase',
  '&:focus': {
    textDecoration: 'underline',
    fontWeight: 700,
  },
  '&:active': {
    textDecoration: 'underline',
    fontWeight: 700,
  },
  '&[aria-disabled="true"]': {
    cursor: 'default',
  },
});

const Submit = styled(Button)(({ theme, dirty }) => ({
  marginRight: 8,
  backgroundColor: theme.color.secondary,
  color: theme.color.inverseText,
  opacity: dirty ? 1 : 0.6,
  boxShadow: 'rgb(30 167 253 / 10%) 0 0 0 1px inset',
}));

const Reset = styled(Button)(({ theme }) => ({
  marginLeft: 8,
  boxShadow: 'rgb(30 167 253) 0 0 0 1px inset',
  color: theme.color.secondary,
}));
