import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

type EmailValidationResult = {
  isValid: boolean;
  raw: unknown;
};

@Injectable()
export class ExternalEmailValidationService {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl =
      this.configService.get<string>('EMAIL_VALIDATION_API_URL') ??
      'https://emailreputation.abstractapi.com/v1/';
    this.apiKey = this.configService.get<string>('EMAIL_VALIDATION_API_KEY') ?? '';
  }

  async validateEmail(email: string): Promise<EmailValidationResult> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('EMAIL_VALIDATION_API_KEY is missing in .env');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(this.apiUrl, {
          params: {
            api_key: this.apiKey,
            email,
          },
        }),
      );

      const raw = response.data as Record<string, unknown>;
      // Support both Abstract payload styles:
      // 1) Email Validation API: is_valid_format.value + deliverability
      // 2) Email Reputation API: email_deliverability.status/is_format_valid/is_smtp_valid
      const validFormatLegacy = this.readBoolean(raw, ['is_valid_format', 'value']);
      const deliverabilityLegacy = this.readString(raw, ['deliverability']);
      const reputationStatus = this.readString(raw, ['email_deliverability', 'status']);
      const reputationFormatValid = this.readBoolean(raw, ['email_deliverability', 'is_format_valid']);
      const reputationSmtpValid = this.readBoolean(raw, ['email_deliverability', 'is_smtp_valid']);

      const isValid =
        validFormatLegacy ||
        deliverabilityLegacy === 'DELIVERABLE' ||
        reputationStatus === 'DELIVERABLE' ||
        (reputationFormatValid && reputationSmtpValid);
      return { isValid, raw };
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        throw new ServiceUnavailableException('Email Validation API rejected provided key');
      }
      if (axiosError.response?.status === 422 || axiosError.response?.status === 429) {
        throw new ServiceUnavailableException('Email Validation API rate/plan limit reached');
      }
      throw new ServiceUnavailableException('Email Validation API is unavailable');
    }
  }

  private readBoolean(payload: Record<string, unknown>, path: string[]): boolean {
    let cursor: unknown = payload;
    for (const key of path) {
      if (!cursor || typeof cursor !== 'object' || !(key in cursor)) {
        return false;
      }
      cursor = (cursor as Record<string, unknown>)[key];
    }
    return cursor === true;
  }

  private readString(payload: Record<string, unknown>, path: string[]): string {
    let cursor: unknown = payload;
    for (const key of path) {
      if (!cursor || typeof cursor !== 'object' || !(key in cursor)) {
        return '';
      }
      cursor = (cursor as Record<string, unknown>)[key];
    }
    return typeof cursor === 'string' ? cursor.toUpperCase() : '';
  }
}
