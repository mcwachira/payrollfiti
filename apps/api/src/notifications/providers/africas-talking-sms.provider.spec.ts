import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { AfricasTalkingSmsProvider } from './africas-talking-sms.provider';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AfricasTalkingSmsProvider', () => {
  let provider: AfricasTalkingSmsProvider;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    configService = { get: jest.fn() };
    provider = new AfricasTalkingSmsProvider(configService as any);
  });

  it('returns a not-configured error when apiKey/username are missing', async () => {
    configService.get.mockReturnValue({});

    const result = await provider.send('+254700000000', 'hello');

    expect(result).toEqual({
      success: false,
      error: 'SMS provider not configured',
    });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('sends successfully and reports success', async () => {
    configService.get.mockReturnValue({
      apiKey: 'key',
      username: 'user',
    });
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        SMSMessageData: {
          Message: 'Sent',
          Recipients: [
            {
              statusCode: 101,
              number: '+254700000000',
              status: 'Success',
              cost: 'KES 0.80',
              messageId: 'abc123',
            },
          ],
        },
      },
    });

    const result = await provider.send('+254700000000', 'hello');

    expect(result).toEqual({ success: true });
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.africastalking.com/version1/messaging',
      expect.any(URLSearchParams),
      expect.objectContaining({
        headers: expect.objectContaining({ apiKey: 'key' }),
      }),
    );
  });

  it('reports failure when the gateway rejects the recipient', async () => {
    configService.get.mockReturnValue({ apiKey: 'key', username: 'user' });
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        SMSMessageData: {
          Message: 'Failed',
          Recipients: [
            {
              statusCode: 401,
              number: '+254700000000',
              status: 'InvalidPhoneNumber',
              cost: 'KES 0.00',
              messageId: 'None',
            },
          ],
        },
      },
    });

    const result = await provider.send('+254700000000', 'hello');

    expect(result).toEqual({
      success: false,
      error: 'InvalidPhoneNumber',
    });
  });

  it('handles a network/API error gracefully', async () => {
    configService.get.mockReturnValue({ apiKey: 'key', username: 'user' });
    mockedAxios.post.mockRejectedValueOnce(new Error('Network down'));

    const result = await provider.send('+254700000000', 'hello');

    expect(result).toEqual({ success: false, error: 'Network down' });
  });
});
