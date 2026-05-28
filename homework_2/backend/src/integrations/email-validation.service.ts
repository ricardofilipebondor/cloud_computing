import { Injectable, ServiceUnavailableException } from '@nestjs/common';

type EmailValidationResult = {
  isValid: boolean;
  raw: unknown;
};

@Injectable()
export class ExternalEmailValidationService {
  async validateEmail(email: string): Promise<EmailValidationResult> {
    try {
      const apiKey = process.env.EMAIL_VALIDATION_API_KEY;
      const apiUrl =
        process.env.EMAIL_VALIDATION_API_URL ?? 'https://emailreputation.abstractapi.com/v1/';

      if (!apiKey) {
        throw new ServiceUnavailableException('EMAIL_VALIDATION_API_KEY is missing in .env');
      }

      const url = `${apiUrl}?api_key=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(
        email,
      )}`;
      const response = await fetch(url);
 
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new ServiceUnavailableException('Email Validation API rejected provided key');
        }
        if (response.status === 422 || response.status === 429) {
          throw new ServiceUnavailableException('Email Validation API rate/plan limit reached');
        }
        throw new ServiceUnavailableException('Email Validation API is unavailable');
      }

      const raw = (await response.json()) as any;

      // Varianta 1: payload simplu
      const validFormatLegacy = raw?.is_valid_format?.value === true;
      const deliverabilityLegacy =
        typeof raw?.deliverability === 'string'
          ? (raw.deliverability as string).toUpperCase()
          : '';

      // Varianta 2: payload cu "email_deliverability"
      const reputationStatus =
        typeof raw?.email_deliverability?.status === 'string'
          ? (raw.email_deliverability.status as string).toUpperCase()
          : '';
      const reputationFormatValid = raw?.email_deliverability?.is_format_valid === true;
      const reputationSmtpValid = raw?.email_deliverability?.is_smtp_valid === true;

      const isValid =
        validFormatLegacy ||
        deliverabilityLegacy === 'DELIVERABLE' ||
        reputationStatus === 'DELIVERABLE' ||
        (reputationFormatValid && reputationSmtpValid);

      return { isValid, raw };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('Email Validation API is unavailable');
    }
  }

}
