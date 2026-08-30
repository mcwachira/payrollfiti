
import { API_URL } from './config';

// Utility responsible for reading, saving and clearing
// access and refresh tokens from localStorage.
import { TokenStorage } from './token-storage';

// DTO describing the structure of the tokens returned
// by the authentication API.
import { AuthTokensDto } from "@/shared-types";


// ---------------------------------------------------------
// API ERROR
// ---------------------------------------------------------

// Custom error class used whenever an API request fails.
//
// Instead of just throwing a normal Error, we also keep
// the HTTP status code.

export class ApiError extends Error {

  constructor(
    // HTTP status code returned by the API.
    // Examples:
    // 400 = Bad Request
    // 401 = Unauthorized
    // 403 = Forbidden
    // 404 = Not Found
    // 500 = Server Error
    public readonly status: number,

    // Human-readable error message.
    message: string
  ) {
    // Pass the message to JavaScript's built-in Error class.
    super(message);

    // Give this error a custom name.
    // This makes debugging easier.
    this.name = 'ApiError';
  }
}


// ---------------------------------------------------------
// REFRESH TOKEN REQUEST LOCK
// ---------------------------------------------------------

// Stores the currently running refresh-token request.
//
// Why do we need this?
//
// Imagine the application makes 5 API requests at almost
// exactly the same time and the access token has expired.
//
// All 5 requests could receive:
//
//     401 Unauthorized
//
// Without this variable, all 5 requests would try to
// refresh the token independently.
//
// Instead, they can share ONE refresh request.
//
// Initially there is no refresh request running.
let refreshPromise: Promise<AuthTokensDto> | null = null;


// ---------------------------------------------------------
// REFRESH ACCESS TOKEN
// ---------------------------------------------------------

// Calls the backend to exchange the refresh token
// for a new access token.
//
// Returns the newly generated authentication tokens.
async function refreshToken(): Promise<AuthTokensDto> {

  // Get the refresh token saved in localStorage.
  const refreshToken = TokenStorage.getRefreshToken();

  // If there is no refresh token, we cannot refresh
  // the user's session.
  if (!refreshToken) {
    throw new ApiError(401, 'No refresh token');
  }


  // Send the refresh token to the backend.
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',

    headers: {
      // Send the refresh token as a Bearer token.
      //
      // Example:
      // Authorization: Bearer eyJhbGciOi...
      Authorization: `Bearer ${refreshToken}`,
    },
  });


  // If the refresh request failed...
  if (!response.ok) {

    // Remove the existing authentication tokens.
    //
    // This means the user's session is no longer valid.
    TokenStorage.clear();

    // Throw an error so the caller knows
    // that the session has expired.
    throw new ApiError(response.status, 'Session expired');
  }


  // Convert the API response from JSON into
  // the AuthTokensDto structure.
  //
  // We expect something similar to:
  //
  // {
  //   accessToken: "...",
  //   refreshToken: "..."
  // }
  const data = (await response.json()) as AuthTokensDto;


  // Save the newly generated access and refresh tokens.
  TokenStorage.setToken(
    data.accessToken,
    data.refreshToken
  );


  // Return the new tokens to the caller.
  return data;
}


// ---------------------------------------------------------
// API FETCH OPTIONS
// ---------------------------------------------------------

// Extends the standard browser RequestInit interface.
//
// RequestInit already supports things such as:
//
// method
// headers
// body
// credentials
// signal
// etc.
//
// We add one custom option:
//
// skipAuth
//
// This allows certain endpoints to be called without
// attaching an Authorization header.
//
// Example:
//
// apiFetch('/auth/login', {
//   method: 'POST',
//   skipAuth: true,
// });
interface ApiFetchOptions extends RequestInit {
  skipAuth?: boolean;
}


// ---------------------------------------------------------
// MAIN API FETCH FUNCTION
// ---------------------------------------------------------

// Generic API request helper.
//
// T represents the expected response type.
//
// Example:
//
// const employee = await apiFetch<Employee>('/employees/123');
//
// TypeScript will then know that `employee` is an Employee.
//
// `isRetry` is used internally to make sure that we don't
// endlessly retry a request when authentication fails.
export async function apiFetch<T>(
  path: string,

  // Request options such as method, headers and body.
  options: ApiFetchOptions = {},

  // Internal flag used when retrying a request after
  // refreshing the access token.
  isRetry = false
): Promise<T> {


  // Extract our custom `skipAuth` option.
  //
  // `headers` is also extracted so that we can merge
  // our authentication headers with user-provided headers.
  //
  // `rest` contains everything else:
  //
  // method
  // body
  // credentials
  // signal
  // etc.
  const {
    skipAuth,
    headers,
    ...rest
  } = options;


  // Get the current access token.
  const accessToken = TokenStorage.getAccessToken();


  // Make the actual HTTP request.
  const response = await fetch(`${API_URL}${path}`, {

    // Spread the remaining request options.
    ...rest,

    headers: {

      // Automatically set Content-Type to JSON when
      // there is a request body that isn't FormData.
      //
      // This means you don't have to manually write:
      //
      // headers: {
      //   'Content-Type': 'application/json'
      // }
      //
      // for every JSON request.
      ...(rest.body && !(rest.body instanceof FormData)
        ? {
            'Content-Type': 'application/json',
          }
        : {}),


      // Attach the access token to authenticated requests.
      //
      // We DON'T attach it when:
      //
      // 1. There is no access token.
      // 2. skipAuth is true.
      //
      // Example:
      //
      // Authorization: Bearer eyJhbGciOi...
      ...(accessToken && !skipAuth
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {}),


      // Finally, include any custom headers supplied
      // by the caller.
      //
      // Because this comes last, custom headers can
      // override the automatically generated ones.
      ...headers,
    },
  });


  // -------------------------------------------------------
  // HANDLE EXPIRED ACCESS TOKEN
  // -------------------------------------------------------

  // A 401 normally means that the access token has expired
  // or is no longer valid.
  //
  // We only attempt to refresh when:
  //
  // 1. The server returned 401.
  // 2. Authentication wasn't explicitly skipped.
  // 3. We haven't already retried this request.
  if (
    response.status === 401 &&
    !skipAuth &&
    !isRetry
  ) {

    try {

      // If there isn't already a refresh request running,
      // start one.
      //
      // `??=` means:
      //
      // "Only assign this value if refreshPromise is null
      // or undefined."
      refreshPromise ??= refreshToken().finally(() => {

        // Once the refresh request finishes,
        // remove the shared promise so future requests
        // can refresh again if necessary.
        refreshPromise = null;
      });


      // Wait for the refresh operation to finish.
      await refreshPromise;


      // Try the original API request again.
      //
      // `true` tells apiFetch that this is a retry.
      //
      // This prevents an infinite loop if the new token
      // is also rejected with 401.
      return apiFetch<T>(
        path,
        options,
        true
      );

    } catch {

      // Refreshing the token failed.
      //
      // Clear the user's authentication state.
      TokenStorage.clear();


      // Tell the application that the user's session
      // has expired.
      throw new ApiError(
        401,
        'Session expired, please log in again'
      );
    }
  }


  // -------------------------------------------------------
  // HANDLE OTHER API ERRORS
  // -------------------------------------------------------

  // If the response wasn't successful, handle the error.
  //
  // Successful responses are normally:
  //
  // 200 OK
  // 201 Created
  // 204 No Content
  if (!response.ok) {

    // Try to read the error response from the API.
    //
    // For example, your backend might return:
    //
    // {
    //   "message": "Employee not found"
    // }
    //
    // If the response isn't valid JSON, use
    // response.statusText instead.
    const body = await response
      .json()
      .catch(() => ({
        message: response.statusText,
      }));


    // Throw our custom API error.
    throw new ApiError(
      response.status,
      body.message ?? 'Request failed'
    );
  }


  // -------------------------------------------------------
  // HANDLE EMPTY RESPONSE
  // -------------------------------------------------------

  // HTTP 204 means:
  //
  // "The request was successful but there is no content."
  //
  // Calling response.json() on a 204 response would fail,
  // so we return undefined.
  if (response.status === 204) {
    return undefined as T;
  }


  // -------------------------------------------------------
  // RETURN API RESPONSE
  // -------------------------------------------------------

  // Convert the response body to JSON and return it.
  //
  // Because this function is generic, TypeScript treats
  // the returned data as type T.
  return response.json() as Promise<T>;
}


// ---------------------------------------------------------
// FILE DOWNLOAD
// ---------------------------------------------------------

/**
 * Downloads binary files such as:
 *
 * - PDF payslips
 * - CSV bank exports
 * - Excel reports
 * - Other generated documents
 *
 * The API returns binary data instead of normal JSON.
 */
export async function apiDownload(
  path: string,
  filename: string
): Promise<void> {

  // Get the current access token.
  const accessToken = TokenStorage.getAccessToken();


  // Request the file from the API.
  const response = await fetch(`${API_URL}${path}`, {

    // Attach the access token when available.
    headers: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : {},
  });


  // If the download failed, throw an API error.
  if (!response.ok) {
    throw new ApiError(
      response.status,
      `Failed to download ${filename}`
    );
  }


  // Convert the response into a Blob.
  //
  // A Blob represents binary data such as:
  //
  // PDF
  // CSV
  // Excel
  // Images
  // ZIP files
  const blob = await response.blob();


  // Create a temporary URL pointing to the Blob.
  //
  // The browser can use this URL to download the file.
  const url = URL.createObjectURL(blob);


  // Create an invisible <a> element.
  //
  // We use an anchor element because browsers understand
  // the `download` attribute.
  const link = document.createElement('a');


  // Tell the link where the file is located.
  link.href = url;


  // Tell the browser what filename to use.
  //
  // Example:
  //
  // "John-Wachira-August-2026-Payslip.pdf"
  link.download = filename;


  // Add the link to the document.
  document.body.appendChild(link);


  // Programmatically click the link.
  //
  // This triggers the browser's download process.
  link.click();


  // Remove the temporary link from the DOM.
  link.remove();


  // Release the temporary Blob URL.
  //
  // This prevents the browser from keeping the Blob
  // in memory unnecessarily.
  URL.revokeObjectURL(url);
}
