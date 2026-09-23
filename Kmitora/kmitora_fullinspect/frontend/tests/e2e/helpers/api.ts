import { expect, type APIRequestContext } from "@playwright/test";

export async function expectHealthy(
  request: APIRequestContext,
  url: string,
): Promise<Record<string, unknown>> {
  const response = await request.get(`${url}/health`);
  expect(response.ok(), `${url}/health must return 2xx`).toBeTruthy();
  const body = await response.json();
  return body as Record<string, unknown>;
}

export async function createFileSource(
  request: APIRequestContext,
  sourceUrl: string,
  filePath: string,
) {
  const payload = {
    name: "KMITORA E2E Golden File Source",
    type: "file",
    filePath,
  };

  const testResponse = await request.post(`${sourceUrl}/v1/sources/test`, {
    data: payload,
  });
  expect(testResponse.ok()).toBeTruthy();

  const createResponse = await request.post(`${sourceUrl}/v1/sources`, {
    data: payload,
  });
  expect(createResponse.status()).toBe(201);
  return createResponse.json();
}
