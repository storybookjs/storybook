import React, { useState } from 'react';

import { Button, Form, Modal } from 'storybook/internal/components';

import { styled } from 'storybook/theming';

import { isChromatic } from '../../../../../.storybook/isChromatic';

interface BaseField {
  label: string;
  options: Record<string, { label: string }>;
  required?: boolean;
}

interface CheckboxField extends BaseField {
  type: 'checkbox';
  values: Record<keyof BaseField['options'], boolean>;
}

interface SelectField extends BaseField {
  type: 'select';
  values: Record<keyof BaseField['options'], boolean>;
}

type FormFields = {
  building: CheckboxField;
  interest: CheckboxField;
  referrer: SelectField;
};

const Content = styled(Modal.Content)(({ theme }) => ({
  fontSize: theme.typography.size.s2,
  color: theme.color.defaultText,
  gap: 8,
}));

const Row = styled.div({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 14,
  marginBottom: 8,
});

const Question = styled.div(({ theme }) => ({
  marginTop: 8,
  marginBottom: 2,
  fontWeight: theme.typography.weight.bold,
}));

const Label = styled.label({
  display: 'flex',
  gap: 8,

  '&:has(input[type="checkbox"]:not(:disabled), input[type="radio"]:not(:disabled))': {
    cursor: 'pointer',
  },
});

const Actions = styled(Modal.Actions)({
  marginTop: 8,
});

const Checkbox = styled(Form.Checkbox)({
  margin: 2,
});

export const IntentSurvey = ({
  onComplete,
  onDismiss,
}: {
  onComplete: (formData: Record<string, Record<string, boolean>>) => void;
  onDismiss: () => void;
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formFields, setFormFields] = useState<FormFields>({
    building: {
      label: 'What are you building?',
      type: 'checkbox',
      required: true,
      options: shuffleObject({
        'design-system': { label: 'Design system' },
        'application-ui': { label: 'Application UI' },
      }),
      values: {
        'design-system': false,
        'application-ui': false,
      },
    },
    interest: {
      label: 'Which of these are you interested in?',
      type: 'checkbox',
      required: true,
      options: shuffleObject({
        'ui-documentation': { label: 'Generating UI docs' },
        'functional-testing': { label: 'Functional testing' },
        'accessibility-testing': { label: 'Accessibility testing' },
        'visual-testing': { label: 'Visual testing' },
        'ai-augmented-development': { label: 'Building UI with AI' },
        'team-collaboration': { label: 'Team collaboration' },
        'design-handoff': { label: 'Design handoff' },
      }),
      values: {
        'ui-documentation': false,
        'functional-testing': false,
        'accessibility-testing': false,
        'visual-testing': false,
        'ai-augmented-development': false,
        'team-collaboration': false,
        'design-handoff': false,
      },
    },
    referrer: {
      label: 'How did you discover Storybook?',
      type: 'select',
      required: true,
      options: shuffleObject({
        'we-use-it-at-work': { label: 'We use it at work' },
        'via-friend-or-colleague': { label: 'Via friend or colleague' },
        'via-social-media': { label: 'Via social media' },
        youtube: { label: 'YouTube' },
        'web-search': { label: 'Web Search' },
        'ai-agent': { label: 'AI Agent (e.g. ChatGPT)' },
      }),
      values: {
        'we-use-it-at-work': false,
        'via-friend-or-colleague': false,
        'via-social-media': false,
        youtube: false,
        'web-search': false,
        'ai-agent': false,
      },
    },
  });

  const updateFormData = (key: keyof FormFields, optionOrValue: string, value?: boolean) => {
    const field = formFields[key];
    setFormFields((fields) => {
      if (field.type === 'checkbox') {
        const values = { ...field.values, [optionOrValue]: !!value };
        return { ...fields, [key]: { ...field, values } };
      }
      if (field.type === 'select') {
        const values = Object.fromEntries(
          Object.entries(field.values).map(([opt]) => [opt, opt === optionOrValue])
        );
        return { ...fields, [key]: { ...field, values } };
      }
      return fields;
    });
  };

  const isValid = Object.values(formFields).every((field) => {
    if (!field.required) {
      return true;
    }
    // Check if at least one option is selected (true)
    return Object.values(field.values).some((value) => value === true);
  });

  const onSubmitForm = (e: React.FormEvent<HTMLFormElement>) => {
    if (!isValid) {
      return;
    }
    e.preventDefault();
    setIsSubmitting(true);
    onComplete(
      Object.fromEntries(Object.entries(formFields).map(([key, field]) => [key, field.values]))
    );
  };

  return (
    <Modal defaultOpen width={420} onEscapeKeyDown={onDismiss}>
      <Form onSubmit={onSubmitForm} id="intent-survey-form">
        <Content>
          <Modal.Header onClose={onDismiss}>
            <Modal.Title>Help improve Storybook</Modal.Title>
          </Modal.Header>

          {(Object.keys(formFields) as Array<keyof FormFields>).map((key) => {
            const field = formFields[key];
            return (
              <React.Fragment key={key}>
                <Question>{field.label}</Question>
                {field.type === 'checkbox' && (
                  <Row>
                    {Object.entries(field.options).map(([opt, option]) => {
                      const id = `${key}:${opt}`;
                      return (
                        <div key={id}>
                          <Label htmlFor={id}>
                            <Checkbox
                              name={id}
                              id={id}
                              checked={field.values[opt]}
                              disabled={isSubmitting}
                              onChange={(e) => updateFormData(key, opt, e.target.checked)}
                            />
                            {option.label}
                          </Label>
                        </div>
                      );
                    })}
                  </Row>
                )}
                {field.type === 'select' && (
                  <Form.Select
                    name={key}
                    id={key}
                    value={
                      Object.entries(field.values).find(([, isSelected]) => isSelected)?.[0] || ''
                    }
                    required={field.required}
                    disabled={isSubmitting}
                    onChange={(e) => updateFormData(key, e.target.value)}
                  >
                    <option disabled hidden value="">
                      Select an option...
                    </option>
                    {Object.entries(field.options).map(([opt, option]) => (
                      <option key={opt} value={opt}>
                        {option.label}
                      </option>
                    ))}
                  </Form.Select>
                )}
              </React.Fragment>
            );
          })}

          <Actions>
            <Button disabled={isSubmitting || !isValid} size="medium" type="submit" variant="solid">
              Submit
            </Button>
          </Actions>
        </Content>
      </Form>
    </Modal>
  );
};

function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function shuffleObject<T extends object>(object: T): T {
  return isChromatic() ? object : (Object.fromEntries(shuffle(Object.entries(object))) as T);
}
