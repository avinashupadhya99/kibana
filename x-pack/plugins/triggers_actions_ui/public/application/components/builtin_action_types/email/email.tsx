/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { uniq } from 'lodash';
import { lazy } from 'react';
import { i18n } from '@kbn/i18n';
import { EuiSelectOption } from '@elastic/eui';
import { AdditionalEmailServices, InvalidEmailReason } from '@kbn/actions-plugin/common';
import {
  ActionTypeModel,
  ConnectorValidationResult,
  GenericValidationResult,
} from '../../../../types';
import { EmailActionParams, EmailConfig, EmailSecrets, EmailActionConnector } from '../types';
import { RegistrationServices } from '..';

const emailServices: EuiSelectOption[] = [
  {
    text: i18n.translate(
      'xpack.triggersActionsUI.components.builtinActionTypes.emailAction.gmailServerTypeLabel',
      {
        defaultMessage: 'Gmail',
      }
    ),
    value: 'gmail',
  },
  {
    text: i18n.translate(
      'xpack.triggersActionsUI.components.builtinActionTypes.emailAction.outlookServerTypeLabel',
      {
        defaultMessage: 'Outlook',
      }
    ),
    value: 'outlook365',
  },
  {
    text: i18n.translate(
      'xpack.triggersActionsUI.components.builtinActionTypes.emailAction.amazonSesServerTypeLabel',
      {
        defaultMessage: 'Amazon SES',
      }
    ),
    value: 'ses',
  },
  {
    text: i18n.translate(
      'xpack.triggersActionsUI.components.builtinActionTypes.emailAction.elasticCloudServerTypeLabel',
      {
        defaultMessage: 'Elastic Cloud',
      }
    ),
    value: 'elastic_cloud',
  },
  {
    text: i18n.translate(
      'xpack.triggersActionsUI.components.builtinActionTypes.emailAction.exchangeServerTypeLabel',
      {
        defaultMessage: 'MS Exchange Server',
      }
    ),
    value: 'exchange_server',
  },
  {
    text: i18n.translate(
      'xpack.triggersActionsUI.components.builtinActionTypes.emailAction.otherServerTypeLabel',
      {
        defaultMessage: 'Other',
      }
    ),
    value: 'other',
  },
];

export function getEmailServices(isCloudEnabled: boolean) {
  return isCloudEnabled
    ? emailServices
    : emailServices.filter((service) => service.value !== 'elastic_cloud');
}

export function getActionType(
  services: RegistrationServices
): ActionTypeModel<EmailConfig, EmailSecrets, EmailActionParams> {
  return {
    id: '.email',
    iconClass: 'email',
    selectMessage: i18n.translate(
      'xpack.triggersActionsUI.components.builtinActionTypes.emailAction.selectMessageText',
      {
        defaultMessage: 'Send email from your server.',
      }
    ),
    actionTypeTitle: i18n.translate(
      'xpack.triggersActionsUI.components.builtinActionTypes.emailAction.actionTypeTitle',
      {
        defaultMessage: 'Send to email',
      }
    ),
    validateConnector: async (
      action: EmailActionConnector
    ): Promise<
      ConnectorValidationResult<Omit<EmailConfig, 'secure' | 'hasAuth'>, EmailSecrets>
    > => {
      const translations = await import('./translations');
      const configErrors = {
        from: new Array<string>(),
        port: new Array<string>(),
        host: new Array<string>(),
        service: new Array<string>(),
        clientId: new Array<string>(),
        tenantId: new Array<string>(),
      };
      const secretsErrors = {
        user: new Array<string>(),
        password: new Array<string>(),
        clientSecret: new Array<string>(),
      };

      const validationResult = {
        config: { errors: configErrors },
        secrets: { errors: secretsErrors },
      };
      if (!action.config.from) {
        configErrors.from.push(translations.SENDER_REQUIRED);
      } else {
        const validatedEmail = services.validateEmailAddresses([action.config.from])[0];
        if (!validatedEmail.valid) {
          const message =
            validatedEmail.reason === InvalidEmailReason.notAllowed
              ? translations.getNotAllowedEmailAddress(action.config.from)
              : translations.getInvalidEmailAddress(action.config.from);
          configErrors.from.push(message);
        }
      }
      if (action.config.service !== AdditionalEmailServices.EXCHANGE) {
        if (!action.config.port) {
          configErrors.port.push(translations.PORT_REQUIRED);
        }
        if (!action.config.host) {
          configErrors.host.push(translations.HOST_REQUIRED);
        }
        if (action.config.hasAuth && !action.secrets.user && !action.secrets.password) {
          secretsErrors.user.push(translations.USERNAME_REQUIRED);
        }
        if (action.config.hasAuth && !action.secrets.user && !action.secrets.password) {
          secretsErrors.password.push(translations.PASSWORD_REQUIRED);
        }
      } else {
        if (!action.config.clientId) {
          configErrors.clientId.push(translations.CLIENT_ID_REQUIRED);
        }
        if (!action.config.tenantId) {
          configErrors.tenantId.push(translations.TENANT_ID_REQUIRED);
        }
        if (!action.secrets.clientSecret) {
          secretsErrors.clientSecret.push(translations.CLIENT_SECRET_REQUIRED);
        }
      }
      if (!action.config.service) {
        configErrors.service.push(translations.SERVICE_REQUIRED);
      }
      if (action.secrets.user && !action.secrets.password) {
        secretsErrors.password.push(translations.PASSWORD_REQUIRED_FOR_USER_USED);
      }
      if (!action.secrets.user && action.secrets.password) {
        secretsErrors.user.push(
          i18n.translate(
            'xpack.triggersActionsUI.components.builtinActionTypes.error.requiredUserText',
            {
              defaultMessage: 'Username is required when password is used.',
            }
          )
        );
      }
      return validationResult;
    },
    validateParams: async (
      actionParams: EmailActionParams
    ): Promise<GenericValidationResult<EmailActionParams>> => {
      const translations = await import('./translations');
      const errors = {
        to: new Array<string>(),
        cc: new Array<string>(),
        bcc: new Array<string>(),
        message: new Array<string>(),
        subject: new Array<string>(),
      };
      const validationResult = { errors };

      if (!actionParams.message?.length) {
        errors.message.push(translations.MESSAGE_REQUIRED);
      }
      if (!actionParams.subject?.length) {
        errors.subject.push(translations.SUBJECT_REQUIRED);
      }

      const toEmails = getToFields(actionParams);
      const ccEmails = getCcFields(actionParams);
      const bccEmails = getBccFields(actionParams);

      if (toEmails.length === 0 && ccEmails.length === 0 && bccEmails.length === 0) {
        const errorText = translations.TO_CC_REQUIRED;
        errors.to.push(errorText);
        errors.cc.push(errorText);
        errors.bcc.push(errorText);
      }

      const allEmails = uniq(toEmails.concat(ccEmails).concat(bccEmails));
      const validatedEmails = services.validateEmailAddresses(allEmails, {
        treatMustacheTemplatesAsValid: true,
      });

      const toEmailSet = new Set(toEmails);
      const ccEmailSet = new Set(ccEmails);
      const bccEmailSet = new Set(bccEmails);

      for (const validated of validatedEmails) {
        if (!validated.valid) {
          const email = validated.address;
          const message =
            validated.reason === InvalidEmailReason.notAllowed
              ? translations.getNotAllowedEmailAddress(email)
              : translations.getInvalidEmailAddress(email);

          if (toEmailSet.has(email)) errors.to.push(message);
          if (ccEmailSet.has(email)) errors.cc.push(message);
          if (bccEmailSet.has(email)) errors.bcc.push(message);
        }
      }

      return validationResult;
    },
    actionConnectorFields: lazy(() => import('./email_connector')),
    actionParamsFields: lazy(() => import('./email_params')),
  };
}

function getToFields(actionParams: EmailActionParams): string[] {
  if (!(actionParams.to instanceof Array)) return [];
  return actionParams.to;
}

function getCcFields(actionParams: EmailActionParams): string[] {
  if (!(actionParams.cc instanceof Array)) return [];
  return actionParams.cc;
}

function getBccFields(actionParams: EmailActionParams): string[] {
  if (!(actionParams.bcc instanceof Array)) return [];
  return actionParams.bcc;
}
